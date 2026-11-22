import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Pattern, RasterImage, TargetSide } from './converter/model'
import { DitherAlgorithm } from './domain/Transformation'

export const Message = defineMessageUnion({
  SelectedLocalImage: { files: Schema.Array(Schema.File) },

  CompletedLoadImage: {
    sourceId: Schema.String,
    name: Schema.String,
    image: RasterImage,
  },
  FailedLoadImage: { reason: Schema.String },

  ChangedPaletteMode: { mode: Schema.Literals(['from-image', 'custom']) },
  ChangedColourCount: { value: Schema.Int },
  AddedCustomColour: { hex: Schema.String },
  RemovedCustomColour: { index: Schema.Int },
  EditedCustomColour: { index: Schema.Int, hex: Schema.String },
  MovedCustomColour: { index: Schema.Int, delta: Schema.Int },
  UpdatedColourDraft: { value: Schema.String },

  ChangedDithering: { algorithm: DitherAlgorithm },
  ChangedTargetSide: { side: TargetSide },
  ChangedTargetStitches: { value: Schema.Int },
  ChangedFabricCount: { value: Schema.Int },
  UpdatedTitle: { value: Schema.String },

  ClickedGenerate: {},
  CompletedRunPipeline: {
    runId: Schema.Int,
    pattern: Pattern,
    stitches: Schema.Uint8Array,
  },
  FailedRunPipeline: { runId: Schema.Int, reason: Schema.String },

  ClickedPreviewMode: { mode: Schema.Literals(['source', 'pattern']) },
  SucceededMountPreview: {},
  FailedMountPreview: { reason: Schema.String },
  ClickedFitPreview: {},
  ClickedStitch: { x: Schema.Int, y: Schema.Int },

  ClickedExportPdf: {},
  CompletedExportPdf: {},
  FailedExportPdf: { reason: Schema.String },

  CompletedFitPreview: {},
  CompletedSyncPreview: {},
})
export type Message = typeof Message.Type
