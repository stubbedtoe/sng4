import { Option, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import {
  Palette as PaletteSchema,
  Pattern,
  RasterImage,
  TargetSide,
} from './converter/model'
import {
  DitherAlgorithm,
  PaletteSpec,
  Project,
  Transformation,
} from './domain/Transformation'

export const SourceState = defineTaggedUnion({
  NoSource: {},
  Loading: {},
  Ready: {
    sourceId: Schema.String,
    name: Schema.String,
    image: RasterImage,
  },
  Failed: { reason: Schema.String },
})
export type SourceState = typeof SourceState.Type

export const PaletteModeChoice = Schema.Literals(['from-image', 'custom'])
export type PaletteModeChoice = typeof PaletteModeChoice.Type

export const PreviewMode = Schema.Literals(['source', 'pattern'])
export type PreviewMode = typeof PreviewMode.Type

export const PreviewStatus = defineTaggedUnion({
  AwaitingSource: {},
  Processing: { runId: Schema.Int },
  Failed: { reason: Schema.String },
  Ready: {
    runId: Schema.Int,
    pattern: Pattern,
    stitches: Schema.Uint8Array,
  },
})
export type PreviewStatus = typeof PreviewStatus.Type

export const PdfStatus = defineTaggedUnion({
  Idle: {},
  Working: {},
  Failed: { reason: Schema.String },
})
export type PdfStatus = typeof PdfStatus.Type

export const StitchSelection = Schema.Struct({
  x: Schema.Int,
  y: Schema.Int,
  symbol: Schema.String,
  flossNumber: Schema.String,
  flossName: Schema.String,
  hex: Schema.String,
})
export type StitchSelection = typeof StitchSelection.Type

export const Model = Schema.Struct({
  source: SourceState,
  title: Schema.String,
  paletteMode: PaletteModeChoice,
  colourCount: Schema.Int,
  maybeCustomPalette: Schema.Option(PaletteSchema),
  dithering: DitherAlgorithm,
  targetSide: TargetSide,
  targetStitches: Schema.Int,
  fabricCount: Schema.Int,
  previewMode: PreviewMode,
  preview: PreviewStatus,
  maybePipelineError: Schema.Option(Schema.String),
  pdf: PdfStatus,
  isPreviewMounted: Schema.Boolean,
  runId: Schema.Int,
  customColourDraft: Schema.String,
  maybeStitchSelection: Schema.Option(StitchSelection),
})
export type Model = typeof Model.Type

export const projectFrom = (model: Model): Option.Option<Project> =>
  SourceState.match(model.source, {
    NoSource: () => Option.none(),
    Loading: () => Option.none(),
    Failed: () => Option.none(),
    Ready: ({ sourceId, image }) =>
      Option.map(maybePaletteSpec(model), palette => ({
        sourceId,
        source: image,
        palette,
        transformations: [
          Transformation.PaletteConversion(),
          Transformation.Dither({ algorithm: model.dithering }),
          Transformation.Pattern({
            targetSide: model.targetSide,
            targetStitches: model.targetStitches,
            fabricCount: model.fabricCount,
          }),
        ],
      })),
  })

const maybePaletteSpec = (model: Model): Option.Option<Project['palette']> => {
  if (model.paletteMode === 'from-image') {
    return Option.some(
      PaletteSpec.Extracted({ colourCount: model.colourCount }),
    )
  }
  return Option.map(model.maybeCustomPalette, palette =>
    PaletteSpec.Custom({ palette }),
  )
}
