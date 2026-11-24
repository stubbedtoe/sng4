# Agent Development Notes

This is a Foldkit app. Read [`FOLDKIT.md`](./FOLDKIT.md) before writing any code in this project. It covers the architecture, the APIs, and the conventions the project is built on.

Foldkit owns `FOLDKIT.md` and replaces it whole on upgrade. This file is yours. Anything you want an agent to know about this project goes below, where an upgrade won't touch it.

`FOLDKIT.md` reads the line below to decide whether it has already offered to vendor the Foldkit source. Leave it in place.

subtree_prompted: false

## Project Notes

This app is **Atomsphere**, a local-first image-to-cross-stitch converter. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for the full picture; the notes below are the day-to-day essentials.

- `src/converter/` is the executable form of `specs/cross-stitch-converter.allium`. The five `*.test.ts` files there are spec-derived (85 tests); treat them as the domain contract. They run against Effect 4 (`Result`, not the removed `Either`).
- The pixel pipeline (decode -> composite -> resize -> quantise -> map/dither -> pattern) lives in `src/transforms/` and `src/services/Pipeline.ts`. Stage results are cached by keys that include the input, parameters, and registry version; cache-hit behaviour (identical object identity) is tested, so keep keys complete when adding stages.
- PixiJS and pixi-viewport are render-only. The Model never holds DOM nodes, Pixi objects, or decoded pixels (those live in the `PixelStore` service). `freezeModel: false` in `src/entry.ts` is deliberate because the Model carries megabyte-scale `Uint8Array` grids.
- Domain vocabulary: a stitch grid is a `Pattern` (1-based `cells`, symbol `key`, `usage`); palette entries are `Floss` values; image-derived palettes use brand `Custom` until a real DMC/Anchor catalogue ships.

## Vendored Repositories

This project vendors external repositories under @repos/

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under @repos/ unless explicitly asked
- Do not import from @repos/ - application code should continue importing from normal package dependencies
