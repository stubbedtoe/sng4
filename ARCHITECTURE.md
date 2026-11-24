# Atomsphere architecture

Atomsphere converts images into cross-stitch patterns entirely in the browser.
This document describes the implemented slice: the domain model, the
transformation pipeline, rendering, PDF generation, and the seams left open
for future features.

## Overview

The canonical application state is a serializable `Project`: a source image
reference, a palette specification, and an ordered list of `Transformation`
values. PixiJS is only a projection of that state onto the screen. GPU
resources, decoded pixels, and canvas objects never enter the domain model, so
the project representation survives a renderer swap and can be persisted later
without change.

```mermaid
flowchart TD
    subgraph Foldkit["Foldkit application (Model / Message / update / view)"]
        UI[Toolbar + workflow sidebar + preview host]
    end

    UI -->|Commands| CMD[Effect commands]
    CMD --> SVC[Effect services]

    subgraph Domain["Domain (pure, serializable)"]
        PROJ[Project: sourceId + source meta + palette spec + Transformation list]
        TRANS[Transformation: PaletteConversion | Dither | Pattern]
        PAT[Pattern: dimensions, cells, key, usage, preview pixels]
        CONV[Converter rules: convertImage, catalogue ops, surfaces]
    end

    subgraph Plugins["Plugin contract"]
        REG[Transformation registry: id, category, inputs, parameters, version, backend]
    end

    subgraph Services["Effect services"]
        IL[ImageLoader: File to pixels, format and size validation]
        PS[(PixelStore: sourceId to RGBA pixels)]
        PL[Pipeline: staged evaluation with result cache]
        PDF[PdfService: Pattern to printable chart]
    end

    subgraph Transforms["Pixel transforms (pure CPU)"]
        RS[resize + composite]
        Q[median-cut quantizer in OKLab]
        NI[nearest-colour mapping via ColourDistance]
        DT[Floyd-Steinberg error diffusion]
        BP[buildPattern: cells, symbols, usage]
    end

    subgraph Rendering["Rendering projection"]
        MNT[Mount: owns Pixi Application + viewport lifecycle]
        HOST[PreviewHandle: setSource / setPattern / fitWorld]
        VP[pixi-viewport: drag, wheel, pinch, clampZoom]
    end

    SVC --> PROJ
    PROJ --> PL
    REG -. definitions and versions .-> PL
    IL --> PS
    PS --> PL
    PL --> RS --> Q
    RS --> NI
    RS --> DT
    NI --> BP
    DT --> BP
    BP --> PAT
    PAT -->|sync command| HOST
    PAT --> PDF
    MNT --> HOST
    HOST --> VP
    VP --> CANVAS[HTML canvas element]
    CMD --> PDF
```

## Layer by layer

### Domain (`src/converter/`, `src/domain/`)

`src/converter/` is the executable form of the Allium specification in
`specs/cross-stitch-converter.allium`. `model.ts` holds the Schema value types
(`Colour`, `RasterImage`, `Palette`, `Pattern`, `ConversionParameters`, the
`Floss` catalogue entities). `convert.ts` implements the `ConvertImage` and
`RejectConversion` rules, `catalogue.ts` the floss catalogue operations, and
`surfaces.ts` the read models the UI renders from. These modules are pure and
are covered by the 85 spec-derived tests in `src/converter/*.test.ts`.

`src/domain/Transformation.ts` adds the prototype's declarative layer:
`Project`, `PaletteSpec` (`Extracted` count or `Custom` palette), and the
`Transformation` union (`PaletteConversion`, `Dither { algorithm }`, `Pattern
{ targetSide, targetStitches, fabricCount }`). The app's Foldkit Model derives
a `Project` from the source and the current choices; changing a parameter
rebuilds the transformation list and the pipeline re-evaluates it.

`src/domain/Colour.ts` defines the colour-distance seam: OKLab conversion plus
a `ColourMatcher` Effect service whose default layer uses Euclidean OKLab
distance. Nothing in the pixel pipeline calls `Math.hypot` on raw RGB; a
different strategy (CIELAB Delta E, weighted OKLab) is a new layer.

### Transformation registry (`src/plugins/registry.ts`)

Every built-in transformation declares the same contract an external plugin
would: `id`, `category`, `inputs`, `parameters` schema, `version`, and
`backend` (`cpu` today; the field exists so a WebGL/WebGPU/worker
implementation can declare itself later). The pipeline reads versions from the
registry when building cache keys, so bumping a plugin version invalidates
prior results automatically. There is no dynamic loading yet by design.

### Services (`src/services/`)

- `ImageLoader` decodes a `File` with `createImageBitmap`, validates the
  declared format against the accepted list, enforces the source-size cap, and
  stores the RGBA pixels in `PixelStore` under a generated id. Errors are
  tagged: `UnsupportedImageFormat`, `ImageDecodeFailure`, `ImageTooLarge`.
- `PixelStore` is a session-scoped Effect service (`Ref<Map>`) so decoded
  megabytes stay out of the Foldkit Model.
- `Pipeline.evaluate(project)` walks the transformation list in order. The last
  mapping stage (`PaletteConversion` or `Dither`) wins; the pattern stage must
  be present. Each stage result is cached under a key that names its input,
  its parameters, and the implementing version, for example
  `from:<source>:<w>x<h>:custom:<entries>:dither:FloydSteinberg:1.0.0`.
  Changing dithering re-runs only the mapping; changing a pattern-display
  option reuses quantisation; decoding happens once per file, ever. Cache
  hits return identical object instances, which the tests assert.
- `PdfService` consumes `Pattern` only (never the Pixi canvas) and renders the
  chart with pdf-lib: a summary page with title, grid and finished dimensions,
  estimate basis, fabric suggestion, and a palette key with per-colour stitch
  counts and skein estimates, followed by paginated grid pages with per-stitch
  symbols, coordinates every 10 stitches, heavier 10-stitch lines, a 2-stitch
  page overlap, and page numbers. Export re-runs `Pipeline.evaluate` with the
  current `Project`; the project is unchanged since the run that produced the
  preview, so this is a guaranteed cache hit returning the full `Pattern`.

### Rendering (`src/rendering/pixi/`)

A Foldkit `Mount` owns the Pixi `Application` and `pixi-viewport` lifecycle:
acquire on element insert, release on removal. The stream yields once before
creating the `Application`: Foldkit forks Mount acquisition synchronously
inside its measured patch phase, so the WebGL context creation and shader
compilation would otherwise be billed to whatever patch inserted the canvas
(a slow-patch warning on an unrelated Message). The live handle sits in a small
module-level registry (the same pattern as the Foldkit map example), so
Commands such as `SyncPreview` and `FitPreview` can reach it without storing
browser objects in the Model. Pan, wheel zoom, touch drag, and pinch come from
pixi-viewport plugins, with zoom clamped to sensible bounds and fit handled by
`fitWorld`.

The pattern renders as a nearest-neighbour texture built from the stitch grid
and palette colours, so it stays sharp at any zoom. The canvas host stays
mounted across source states (empty/loading/failed views are overlays, not
branch replacements): replacing it would destroy and recreate the whole
Pixi/WebGL stack on every image load and reset the zoom. There is
deliberately no grid or symbol overlay on the canvas right now: keeping one
pixel-locked to
the stitch edges across zoom, pan, and DPR proved finicky — the placement
formula (`floor(d − 0.5)` in device px, strict tie-breaking) was verified
exact against the live renderer with pixel probes, but the visual result
still read as drifting at some zoom levels — so the overlay was removed
pending a re-think, likely a WebGL-native grid or render-texture tiling
rather than a Canvas2D sprite stretched over the viewport. Clicking a stitch
still works (the viewport reports world coordinates) and the sidebar shows
the lookup (symbol, floss name and number, colour swatch); symbols remain
visible there and in the PDF chart. The current zoom is shown in the canvas
overlay with zoom-in/zoom-out buttons, expressed relative to the
fit-to-canvas scale (the initial size, 100%). The handle reports percent
changes on pixi-viewport's `zoomed` event (throttled to whole percents, and
recomputed when a resize changes the fit scale) through a Mount message, and
`zoomBy` rescales around the current viewport centre. Zooming out below 100%
anchors the content centre to the canvas centre, for both the buttons and
the wheel/pinch path. Pinch, wheel, and buttons all arrive through the same
`zoomed` event, so the readout stays honest regardless of input. The source
image and its derived pattern share a content id (the `sourceId`), so
switching between them — or re-running the pipeline — carries the zoom
percent and viewport centre across instead of re-fitting; only a genuinely
new source id fits. Canvas resizes (window changes) also preserve the
percent: the scale is re-derived from the new fit scale, so 100% tracks the
canvas. Viewport
interaction state never becomes a domain transformation.

### Foldkit shell (`src/main.ts`, `src/update.ts`, `src/view/`)

Standard Foldkit architecture: `init`/`update`/`view`, Commands for file
loading, pipeline runs, preview sync, fit, and PDF export, and a responsive
layout (canvas on top, workflow controls below on mobile; sidebar on
desktop). On wide devices the app shell is anchored to exactly the viewport
height (`md:h-dvh md:overflow-hidden`) and the sidebar scrolls internally,
so re-renders that grow or shrink sidebar content cannot resize the canvas
area — the preview canvas has a stable height and never shifts.
Each sidebar section and the toolbar are memoized with `createLazy` against
their own Model dependencies (reference-stable thanks to structural sharing),
so a message only rebuilds the subtrees it actually affects. A `runId` on
every pipeline request makes results stale-proof: a slow run that
finishes after a newer request is ignored. `freezeModel` is disabled in dev
because the Model holds the stitch-index grid (`Uint8Array`) that deep-freezing
after every update would dominate interaction latency.

The ready state is deliberately slim: `PreviewStatus.Ready` holds a
`PatternSummary` (dimensions, finished dimensions, estimate basis, fabric
suggestion, key, usage, palette) plus one palette index per stitch. The
per-stitch `cells` records and the `preview.maybePixels` raster are derived
data and never enter the Model — they stay in the pipeline stage cache, are
rebuilt on demand (stitch clicks index into the key; PDF export re-runs the
pipeline as a cache hit), and remain part of the domain `Pattern` only because
the spec-derived contract asserts them.

## Testing

- `src/converter/*.test.ts`: the 85 spec-derived tests (rules, invariants,
  surfaces, catalogue).
- `src/domain/Colour.test.ts`, `src/transforms/*.test.ts`: colour distance,
  nearest-palette selection, deterministic quantisation, Floyd-Steinberg
  behaviour (exact expected indices), pattern construction, and a synthetic
  image fixture with exact palette-index assertions.
- `src/services/Pipeline.test.ts`: transformation ordering (last mapping wins),
  expected failures, and cache key behaviour verified by object identity
  across evaluations.
- `src/services/PdfService.test.ts`: valid PDF output, multi-page pagination,
  determinism.
- `src/story.test.ts`: Foldkit story tests for the update loop (stale results,
  rerun requests, palette seeding, stitch lookup).

## Deliberate shortcuts in this slice

1. **CPU-only processing.** No Web Worker or GPU stage yet. Working grids are
   capped at 500 stitches per side and a full run at the default 100 stitches
   takes milliseconds. The pipeline yields between stages and the UI debounces
   reruns; the seam for off-main-thread stages is the registry `backend`
   field.
2. **Nearest-neighbour resize** before colour mapping. AArea-averaged sampling
   would anti-alias less on downscales; nearest keeps the conversion
   deterministic and stitch-aligned.
3. **In-memory, unbounded stage caches** keyed per source. Old sources age out
   only when the session ends. A TTL or LRU bound is a two-line change once
   real projects arrive.
4. **Floss usage is a documented estimate** (2.5 m of floss per stitch per
   strand, rounded up to whole skeins). Real coverage varies with fabric count
   and stitcher habits; the estimate basis is printed on the PDF so the
   numbers stay interpretable.
5. **Custom-palette editing uses generic `Custom` flosses** numbered by
   position. Brand and number become meaningful identities the moment a real
   catalogue ships.
6. **The distilled `convertImage` keeps a metadata-only mode**: when a
   `RasterImage` carries no pixels (the spec-level tests), it synthesizes a
   uniform stitch grid instead of running the pixel pipeline. The UI never
   uses this path; it exists so the spec rules run purely.
7. **Canvas2D overlay instead of Pixi `Text` pooling** for symbols. It redraws
   only the visible region on view changes and keeps the Pixi scene trivial.
8. **No persistence.** Refreshing clears everything, per the slice scope.
   `Project` is Schema-typed and serializable today; flags/localStorage or
   IndexedDB can adopt it unchanged.

## Extension points

- **Persistence / project library**: serialize `Project` (and re-derive
  patterns through the pipeline). `PixelStore` becomes an IndexedDB blob
  store keyed by `sourceId`.
- **ATProto / sharing**: `Project` JSON is the sync document; the pipeline is
  a pure function of it, so two peers converge on identical patterns.
- **Workers / GPU**: add stages whose registry entry declares `backend:
'worker' | 'webgl' | 'webgpu'`; the pipeline already treats stages as cached
  effects, so swapping execution context does not change cache keys or the
  domain model.
- **DMC / Anchor palettes**: a new `PaletteSource` that resolves a catalogue
  (the `FlossCatalogue` entity and its add/edit/remove rules already exist and
  are tested). `PaletteSpec.Extracted` can target a catalogue instead of the
  median-cut extractor without touching the pipeline.
- **External transformation plugins**: implement the registry contract (id,
  category, inputs, parameter schema, version, backend) and register new
  dithering algorithms (Atkinson, Jarvis-Judice-Ninke, Stucki, Bayer) next to
  `ditherToIndexed`. The UI renders registry labels and the cache keys pick up
  the new version automatically.
