import { Option, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import {
  EstimateBasis,
  FabricSuggestion,
  FinishedDimensions,
  FlossUsage,
  KeyEntry,
  Palette as PaletteSchema,
  Pattern,
  RasterImage,
  StitchDimensions,
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

// Everything the UI needs from a completed pattern except the per-stitch
// data. `cells` and `preview.maybePixels` stay in the pipeline cache (the
// full Pattern) and are derived on demand; the Model only retains one byte
// per stitch plus palette-sized metadata.
export const PatternSummary = Schema.Struct({
  stitchDimensions: StitchDimensions,
  finishedDimensions: FinishedDimensions,
  estimateBasis: EstimateBasis,
  suggestedFabric: FabricSuggestion,
  key: Schema.Array(KeyEntry),
  usage: Schema.Array(FlossUsage),
  palette: PaletteSchema,
})
export type PatternSummary = typeof PatternSummary.Type

export const summaryFromPattern = (pattern: Pattern): PatternSummary => ({
  stitchDimensions: pattern.stitchDimensions,
  finishedDimensions: pattern.finishedDimensions,
  estimateBasis: pattern.estimateBasis,
  suggestedFabric: pattern.suggestedFabric,
  key: pattern.key,
  usage: pattern.usage,
  palette: pattern.palette,
})

export const PreviewStatus = defineTaggedUnion({
  AwaitingSource: {},
  Processing: { runId: Schema.Int },
  Failed: { reason: Schema.String },
  Ready: {
    runId: Schema.Int,
    summary: PatternSummary,
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
  previewZoom: Schema.Int,
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
