# Atomsphere

A local-first image-to-cross-stitch prototype. Open an image from your
filesystem, extract or build a colour palette, convert and dither it into
stitches, inspect the pattern in a pan/zoom viewport, and print a multi-page
PDF chart. Everything runs in the browser; no image ever leaves the machine.

Built with TypeScript (strict), Effect.ts, Foldkit, PixiJS v8, pixi-viewport,
and pdf-lib.

## Getting started

```bash
pnpm install
pnpm dev
```

Then open the printed URL (defaults to <http://localhost:5173>).

## Scripts

| Command          | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `pnpm dev`       | Vite dev server with Foldkit HMR and devtools               |
| `pnpm build`     | Production build to `dist/`                                 |
| `pnpm preview`   | Serve the production build                                  |
| `pnpm test`      | Vitest (domain unit tests, spec tests, Foldkit story tests) |
| `pnpm typecheck` | `tsc --noEmit`                                              |
| `pnpm lint`      | oxlint with the Foldkit and Effect rule sets                |
| `pnpm format`    | oxfmt                                                       |

## Using the app

1. Choose a local JPEG, PNG, or WebP image.
2. Pan with drag, zoom with the mouse wheel or a pinch gesture. Fit resets the
   view.
3. Pick a palette source: From image (4 to 32 colours, median-cut extraction)
   or Custom (add, remove, edit, and reorder colours).
4. Toggle Floyd-Steinberg dithering and watch the pattern update.
5. Zoom in to inspect individual stitches and their symbols. Click a stitch to
   look up its colour.
6. Set the target stitch count and fabric count, then download the printable
   PDF chart.

## Documentation

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the architecture, the
transformation registry contract, caching, deliberate shortcuts, and the
extension points for persistence, ATProto, worker/GPU processing, thread
catalogues, and external plugins.

The executable domain specification distilled from
[`specs/cross-stitch-converter.allium`](./specs/cross-stitch-converter.allium)
lives in `src/converter/` alongside its tests.
