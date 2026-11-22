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
        OVL[Canvas2D overlay: grid lines + stitch symbols]
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
    HOST --> OVL
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
  page overlap, and page numbers.

### Rendering (`src/rendering/pixi/`)

A Foldkit `Mount` owns the Pixi `Application` and `pixi-viewport` lifecycle:
acquire on element insert, release on removal. The live handle sits in a small
module-level registry (the same pattern as the Foldkit map example), so
Commands such as `SyncPreview` and `FitPreview` can reach it without storing
browser objects in the Model. Pan, wheel zoom, touch drag, and pinch come from
pixi-viewport plugins, with zoom clamped to sensible bounds and fit handled by
`fitWorld`.

The pattern renders as a nearest-neighbour texture built from the stitch grid
and palette colours, so it stays sharp at any zoom. A Canvas2D overlay sprite
(redrawn on a dirty flag after pan/zoom/resize) draws grid lines, heavier
lines every 10 stitches, and one symbol per stitch once cells are large
enough. Clicking a stitch emits a Foldkit Message and the sidebar shows the
lookup (symbol, floss name and number, colour swatch). Viewport interaction
state never becomes a domain transformation.

### Foldkit shell (`src/main.ts`, `src/update.ts`, `src/view/`)

Standard Foldkit architecture: `init`/`update`/`view`, Commands for file
loading, pipeline runs, preview sync, fit, and PDF export, and a responsive
layout (canvas on top, workflow controls below on mobile; sidebar on desktop).
A `runId` on every pipeline request makes results stale-proof: a slow run that
finishes after a newer request is ignored. `freezeModel` is disabled in dev
because the Model holds megabyte-scale preview grids that deep-freezing after
every update would dominate interaction latency.

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
