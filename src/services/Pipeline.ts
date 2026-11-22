import { Context, Effect, Layer, Ref, Schema } from 'effect'

import { CONVERTER_CONFIG } from '../converter/config'
import { exceedsLimits } from '../converter/convert'
import { fitDimensions } from '../converter/dimensions'
import {
  type ImagePixels,
  type Palette,
  type Pattern,
  type StitchDimensions,
} from '../converter/model'
import type { Project, Transformation } from '../domain/Transformation'
import { TransformationRegistry } from '../plugins/registry'
import {
  type IndexedImage,
  convertToIndexed,
  ditherToIndexed,
  preparePalette,
} from '../transforms/indexed'
import { buildPattern } from '../transforms/pattern'
import { QUANTIZER_VERSION, quantize } from '../transforms/quantize'
import {
  compositeOverBackground,
  resizePixelsNearest,
} from '../transforms/resize'
import { PixelStore, SourcePixelsNotFound } from './PixelStore'

export class NoPatternTransformation extends Schema.TaggedError<NoPatternTransformation>()(
  'NoPatternTransformation',
  {},
) {}

export class NoIndexedImage extends Schema.TaggedError<NoIndexedImage>()(
  'NoIndexedImage',
  {},
) {}

export class ProjectExceedsLimits extends Schema.TaggedError<ProjectExceedsLimits>()(
  'ProjectExceedsLimits',
  { reason: Schema.String },
) {}

export interface PipelineOutput {
  readonly pattern: Pattern
  readonly indexed: IndexedImage
  readonly stitches: Uint8Array
  readonly palette: Palette
  readonly dimensions: StitchDimensions
}

export type PipelineError =
  | NoPatternTransformation
  | NoIndexedImage
  | ProjectExceedsLimits
  | SourcePixelsNotFound

const extractPalette = (pixels: ImagePixels, colourCount: number): Palette => ({
  source: 'derived',
  entries: quantize(pixels, colourCount).map((colour, index) => ({
    brand: 'Custom',
    number: `C${index + 1}`,
    name: `Colour ${index + 1}`,
    colour,
  })),
})

const findPatternTransformation = (
  transformations: ReadonlyArray<Transformation>,
): Extract<Transformation, { _tag: 'Pattern' }> | undefined => {
  let found: Extract<Transformation, { _tag: 'Pattern' }> | undefined
  for (const transformation of transformations) {
    if (transformation._tag === 'Pattern') {
      found = transformation
    }
  }
  return found
}

const requestedColours = (project: Project): number =>
  project.palette._tag === 'Extracted'
    ? project.palette.colourCount
    : project.palette.palette.entries.length

export interface PipelineService {
  readonly evaluate: (
    project: Project,
  ) => Effect.Effect<PipelineOutput, PipelineError>
}

const paletteKeyFor = (project: Project): string =>
  project.palette._tag === 'Extracted'
    ? `extracted:${project.sourceId}:${project.palette.colourCount}:${QUANTIZER_VERSION}`
    : `custom:${JSON.stringify(project.palette.palette.entries)}`

const makeStageCache = <A>(): Effect.Effect<
  (key: string, compute: () => A) => Effect.Effect<A>
> =>
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<string, A>())
    return (key, compute) =>
      Effect.gen(function* () {
        const cached = (yield* Ref.get(store)).get(key)
        if (cached !== undefined) {
          return cached
        }
        const value = compute()
        yield* Ref.update(store, entries => new Map(entries).set(key, value))
        return value
      })
  })

export class Pipeline extends Context.Service<Pipeline, PipelineService>()(
  'Pipeline',
) {
  static readonly layer: Layer.Layer<
    Pipeline,
    never,
    PixelStore | TransformationRegistry
  > = Layer.effect(
    Pipeline,
    Effect.gen(function* () {
      const pixelStore = yield* PixelStore
      const registry = yield* TransformationRegistry

      const cacheComposite = yield* makeStageCache<ImagePixels>()
      const cachePalette = yield* makeStageCache<Palette>()
      const cacheIndexed = yield* makeStageCache<IndexedImage>()
      const cachePattern = yield* makeStageCache<Pattern>()

      return {
        evaluate: project =>
          Effect.gen(function* () {
            const patternTransformation = findPatternTransformation(
              project.transformations,
            )
            if (patternTransformation === undefined) {
              return yield* Effect.fail(new NoPatternTransformation())
            }

            if (
              exceedsLimits(
                project.source,
                patternTransformation.targetSide,
                patternTransformation.targetStitches,
                requestedColours(project),
              )
            ) {
              return yield* Effect.fail(
                new ProjectExceedsLimits({
                  reason: 'exceeds product limits or unsupported image format',
                }),
              )
            }

            const dimensions = fitDimensions(
              project.source,
              patternTransformation.targetSide,
              patternTransformation.targetStitches,
            )

            const sourcePixels = yield* pixelStore.get(project.sourceId)

            const composited = yield* cacheComposite(
              `composite:${project.sourceId}`,
              () =>
                compositeOverBackground(
                  sourcePixels,
                  CONVERTER_CONFIG.default_background,
                ),
            )
            yield* Effect.yieldNow

            const resized = resizePixelsNearest(
              composited,
              dimensions.width,
              dimensions.height,
            )
            yield* Effect.yieldNow

            const paletteKey = paletteKeyFor(project)
            const palette = yield* cachePalette(paletteKey, () =>
              project.palette._tag === 'Extracted'
                ? extractPalette(composited, project.palette.colourCount)
                : project.palette.palette,
            )
            yield* Effect.yieldNow

            const prepared = preparePalette(
              palette.entries.map(entry => entry.colour),
            )

            const paletteConversionVersion =
              registry.entryFor('palette-conversion')?.definition.version ??
              'builtin'
            const ditherVersion =
              registry.entryFor('dither')?.definition.version ?? 'builtin'
            const patternVersion =
              registry.entryFor('pattern')?.definition.version ?? 'builtin'

            const mappingKeyPrefix = `from:${project.sourceId}:${dimensions.width}x${dimensions.height}:${paletteKey}`
            let indexed: IndexedImage | undefined
            let indexedKey = ''
            for (const transformation of project.transformations) {
              if (transformation._tag === 'PaletteConversion') {
                indexedKey = `${mappingKeyPrefix}:convert:${paletteConversionVersion}`
                indexed = yield* cacheIndexed(indexedKey, () =>
                  convertToIndexed(resized, prepared),
                )
                yield* Effect.yieldNow
              }
              if (transformation._tag === 'Dither') {
                indexedKey =
                  transformation.algorithm === 'None'
                    ? `${mappingKeyPrefix}:dither:None:${ditherVersion}`
                    : `${mappingKeyPrefix}:dither:${transformation.algorithm}:${ditherVersion}`
                indexed = yield* cacheIndexed(indexedKey, () =>
                  transformation.algorithm === 'None'
                    ? convertToIndexed(resized, prepared)
                    : ditherToIndexed(resized, prepared),
                )
                yield* Effect.yieldNow
              }
            }

            if (indexed === undefined) {
              return yield* Effect.fail(new NoIndexedImage())
            }

            const pattern = yield* cachePattern(
              `${indexedKey}:pattern:${patternTransformation.fabricCount}:${patternVersion}`,
              () =>
                buildPattern({
                  indexed,
                  palette,
                  fabricCount: patternTransformation.fabricCount,
                }),
            )

            return {
              pattern,
              indexed,
              stitches: indexed.indices,
              palette,
              dimensions,
            }
          }),
      }
    }),
  )
}
