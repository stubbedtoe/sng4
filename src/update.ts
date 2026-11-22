import { Array, Option } from 'effect'
import { SecureRandom } from 'effect/crypto'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import {
  ExportPatternPdf,
  FitPreview,
  LoadImageFile,
  RunPipeline,
  SyncPreview,
} from './command'
import { PREVIEW_HOST_ID } from './constant'
import { CONVERTER_CONFIG } from './converter/config'
import { type Colour, CrafterDevice } from './converter/model'
import type { Palette } from './converter/model'
import { lookUpStitch } from './converter/surfaces'
import { colourToHex } from './domain/Colour'
import { Message } from './message'
import {
  type Model,
  PdfStatus,
  PreviewStatus,
  SourceState,
  projectFrom,
} from './model'
import {
  hexToColourOption,
  renumberPalette,
  seedCustomPalette,
} from './palette'
import type { ImageLoader } from './services/ImageLoader'
import type { PdfService } from './services/PdfService'
import type { Pipeline } from './services/Pipeline'
import type { PixelStore } from './services/PixelStore'

type AppResources =
  | ImageLoader
  | PdfService
  | Pipeline
  | PixelStore
  | SecureRandom.SecureRandom

type UpdateReturn = Update.Return<Model, Message, AppResources>

const previewDevice: CrafterDevice = CrafterDevice.make({
  sessionStartedAt: new Date(0),
})

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const requestRerun = (model: Model, nextModel: Model): UpdateReturn => {
  const nextRunId = model.runId + 1
  const bumpedModel = modifyFields(nextModel, {
    runId: () => nextRunId,
    maybePipelineError: () => Option.none(),
    maybeStitchSelection: () => Option.none(),
  })
  return Option.match(projectFrom(bumpedModel), {
    onNone: () => ({ model: bumpedModel }),
    onSome: project => ({
      model: modifyFields(bumpedModel, {
        preview: () => PreviewStatus.Processing({ runId: nextRunId }),
      }),
      commands: [RunPipeline({ runId: nextRunId, project })],
    }),
  })
}

const syncPreview = (model: Model) => {
  const maybePattern = PreviewStatus.match(model.preview, {
    AwaitingSource: () => Option.none(),
    Processing: () => Option.none(),
    Failed: () => Option.none(),
    Ready: ({ pattern, stitches }) =>
      Option.some({
        stitches,
        width: pattern.stitchDimensions.width,
        height: pattern.stitchDimensions.height,
        palette: pattern.palette,
      }),
  })
  const maybeSourceId = SourceState.match(model.source, {
    NoSource: () => Option.none(),
    Loading: () => Option.none(),
    Ready: ({ sourceId }) => Option.some(sourceId),
    Failed: () => Option.none(),
  })
  return SyncPreview({
    hostId: PREVIEW_HOST_ID,
    mode: model.previewMode,
    maybeSourceId,
    maybePattern,
  })
}

const withCustomPaletteUpdate = (
  model: Model,
  updatePalette: (palette: Palette) => Option.Option<Palette>,
): UpdateReturn =>
  Option.match(model.maybeCustomPalette, {
    onNone: () => ({ model }),
    onSome: palette => {
      const nextModel = modifyFields(model, {
        maybeCustomPalette: () => updatePalette(palette),
      })
      return requestRerun(model, nextModel)
    },
  })

const hexToFlossColour = (hex: string): Option.Option<Colour> =>
  hexToColourOption(hex)

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    SelectedLocalImage: ({ files }) =>
      Array.match(files, {
        onEmpty: () => ({ model }),
        onNonEmpty: ([file]) => ({
          model: modifyFields(model, {
            source: () => SourceState.Loading(),
            maybeStitchSelection: () => Option.none(),
          }),
          commands: [LoadImageFile({ file })],
        }),
      }),

    CompletedLoadImage: ({ sourceId, name, image }) => {
      const nextModel = modifyFields(model, {
        source: () => SourceState.Ready({ sourceId, name, image }),
      })
      return requestRerun(model, nextModel)
    },

    FailedLoadImage: ({ reason }) => ({
      model: modifyFields(model, {
        source: () => SourceState.Failed({ reason }),
        preview: () => PreviewStatus.AwaitingSource(),
      }),
    }),

    ChangedPaletteMode: ({ mode }) => {
      const nextModel = modifyFields(model, {
        paletteMode: () => mode,
        maybeCustomPalette: current =>
          mode === 'custom' && Option.isNone(current)
            ? Option.some(seedCustomPalette())
            : current,
      })
      return requestRerun(model, nextModel)
    },

    ChangedColourCount: ({ value }) =>
      requestRerun(
        model,
        modifyFields(model, {
          colourCount: () =>
            clamp(
              value,
              CONVERTER_CONFIG.min_colours,
              CONVERTER_CONFIG.max_colours,
            ),
        }),
      ),

    AddedCustomColour: ({ hex }) =>
      Option.match(model.maybeCustomPalette, {
        onNone: () => ({ model }),
        onSome: palette =>
          palette.entries.length >= CONVERTER_CONFIG.max_colours
            ? { model }
            : withCustomPaletteUpdate(model, current =>
                Option.map(hexToFlossColour(hex), colour =>
                  renumberPalette({
                    source: current.source,
                    entries: [
                      ...current.entries,
                      { brand: 'Custom', number: '', name: '', colour },
                    ],
                  }),
                ),
              ),
      }),

    RemovedCustomColour: ({ index }) =>
      withCustomPaletteUpdate(model, palette =>
        Option.some(
          renumberPalette({
            source: palette.source,
            entries: palette.entries.filter(
              (_, entryIndex) => entryIndex !== index,
            ),
          }),
        ),
      ),

    EditedCustomColour: ({ index, hex }) =>
      withCustomPaletteUpdate(model, palette =>
        Option.map(hexToFlossColour(hex), colour =>
          renumberPalette({
            source: palette.source,
            entries: palette.entries.map((entry, entryIndex) =>
              entryIndex === index ? { ...entry, colour } : entry,
            ),
          }),
        ),
      ),

    MovedCustomColour: ({ index, delta }) =>
      withCustomPaletteUpdate(model, palette => {
        const target = index + delta
        const entries = [...palette.entries]
        const moving = entries[index]
        const displaced = entries[target]
        if (moving === undefined || displaced === undefined) {
          return Option.some(palette)
        }
        entries[index] = displaced
        entries[target] = moving
        return Option.some(renumberPalette({ source: palette.source, entries }))
      }),

    UpdatedColourDraft: ({ value }) => ({
      model: modifyFields(model, { customColourDraft: () => value }),
    }),

    ChangedDithering: ({ algorithm }) =>
      requestRerun(model, modifyFields(model, { dithering: () => algorithm })),

    ChangedTargetSide: ({ side }) =>
      requestRerun(model, modifyFields(model, { targetSide: () => side })),

    ChangedTargetStitches: ({ value }) =>
      requestRerun(
        model,
        modifyFields(model, {
          targetStitches: () =>
            clamp(value, 1, CONVERTER_CONFIG.max_pattern_side),
        }),
      ),

    ChangedFabricCount: ({ value }) =>
      requestRerun(
        model,
        modifyFields(model, { fabricCount: () => clamp(value, 1, 60) }),
      ),

    UpdatedTitle: ({ value }) => ({
      model: modifyFields(model, { title: () => value }),
    }),

    ClickedGenerate: () => requestRerun(model, model),

    CompletedRunPipeline: ({ runId, pattern, stitches }) => {
      if (runId !== model.runId) {
        return { model }
      }
      const nextModel = modifyFields(model, {
        preview: () => PreviewStatus.Ready({ runId, pattern, stitches }),
        maybePipelineError: () => Option.none(),
      })
      return { model: nextModel, commands: [syncPreview(nextModel)] }
    },

    FailedRunPipeline: ({ runId, reason }) => {
      if (runId !== model.runId) {
        return { model }
      }
      if (model.preview._tag === 'Ready') {
        return {
          model: modifyFields(model, {
            maybePipelineError: () => Option.some(reason),
          }),
        }
      }
      return {
        model: modifyFields(model, {
          preview: () => PreviewStatus.Failed({ reason }),
          maybePipelineError: () => Option.some(reason),
        }),
      }
    },

    ClickedPreviewMode: ({ mode }) => {
      const nextModel = modifyFields(model, { previewMode: () => mode })
      return { model: nextModel, commands: [syncPreview(nextModel)] }
    },

    SucceededMountPreview: () => ({
      model: modifyFields(model, { isPreviewMounted: () => true }),
      commands: [syncPreview(model)],
    }),

    FailedMountPreview: ({ reason }) => ({
      model: modifyFields(model, {
        isPreviewMounted: () => false,
        preview: () => PreviewStatus.Failed({ reason }),
      }),
    }),

    ClickedFitPreview: () => ({
      model,
      commands: [FitPreview({ hostId: PREVIEW_HOST_ID })],
    }),

    ClickedStitch: ({ x, y }) =>
      PreviewStatus.match(model.preview, {
        AwaitingSource: () => ({ model }),
        Processing: () => ({ model }),
        Failed: () => ({ model }),
        Ready: ({ pattern }) =>
          Option.match(lookUpStitch(previewDevice, pattern, x, y), {
            onNone: () => ({ model }),
            onSome: lookup => {
              const keyEntry = pattern.key.find(
                entry => entry.symbol === lookup.symbol,
              )
              if (keyEntry === undefined) {
                return { model }
              }
              return {
                model: modifyFields(model, {
                  maybeStitchSelection: () =>
                    Option.some({
                      x,
                      y,
                      symbol: lookup.symbol,
                      flossNumber: keyEntry.floss.number,
                      flossName: keyEntry.floss.name,
                      hex: colourToHex(keyEntry.floss.colour),
                    }),
                }),
              }
            },
          }),
      }),

    ClickedExportPdf: () =>
      PreviewStatus.match(model.preview, {
        AwaitingSource: () => ({ model }),
        Processing: () => ({ model }),
        Failed: () => ({ model }),
        Ready: ({ pattern }) => ({
          model: modifyFields(model, { pdf: () => PdfStatus.Working() }),
          commands: [ExportPatternPdf({ title: model.title, pattern })],
        }),
      }),

    CompletedExportPdf: () => ({
      model: modifyFields(model, { pdf: () => PdfStatus.Idle() }),
    }),

    FailedExportPdf: ({ reason }) => ({
      model: modifyFields(model, { pdf: () => PdfStatus.Failed({ reason }) }),
    }),

    CompletedFitPreview: () => ({ model }),

    CompletedSyncPreview: () => ({ model }),
  })
