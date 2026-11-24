import { Array, Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import {
  ExportPatternPdf,
  RunPipeline,
  SyncPreview,
  ZoomPreview,
} from './command'
import { init } from './main'
import { Message } from './message'
import type { Model, PatternSummary } from './model'
import { SourceState } from './model'
import { update } from './update'

const initialModel: Model = init().model

const loadedSource = SourceState.Ready({
  sourceId: 'source-1',
  name: 'photo.png',
  image: {
    width: 4,
    height: 2,
    hasTransparency: false,
    format: 'PNG',
    maybePixels: Option.none(),
  },
})

const readySummary = (
  overrides: Partial<PatternSummary> = {},
): PatternSummary => ({
  stitchDimensions: { width: 2, height: 2 },
  finishedDimensions: {
    widthIn: 2 / 14,
    heightIn: 2 / 14,
    widthCm: (2 / 14) * 2.54,
    heightCm: (2 / 14) * 2.54,
  },
  estimateBasis: { fabricCount: 14, strands: 2, skeinLengthM: 8 },
  suggestedFabric: { count: 14, cutWidthCm: 20, cutHeightCm: 20 },
  key: [
    {
      symbol: 'A',
      floss: {
        brand: 'Custom',
        number: 'C1',
        name: 'Colour C1',
        colour: { red: 0, green: 0, blue: 0 },
      },
    },
  ],
  usage: [
    {
      floss: {
        brand: 'Custom',
        number: 'C1',
        name: 'Colour C1',
        colour: { red: 0, green: 0, blue: 0 },
      },
      stitchCount: 1,
      skeins: 1,
    },
  ],
  palette: { source: 'supplied', entries: [] },
  ...overrides,
})

describe('update', () => {
  test('ChangedDithering updates the choice without a source and does not run the pipeline', () => {
    story(
      update,
      given(initialModel),
      message(Message.ChangedDithering({ algorithm: 'None' })),
      Command.expectNone(),
      model(nextModel => {
        expect(nextModel.dithering).toBe('None')
        expect(nextModel.preview._tag).toBe('AwaitingSource')
      }),
    )
  })

  test('CompletedLoadImage marks the source ready and starts a pipeline run', () => {
    story(
      update,
      given(initialModel),
      message(
        Message.CompletedLoadImage({
          sourceId: 'source-1',
          name: 'photo.png',
          image: {
            width: 4,
            height: 2,
            hasTransparency: false,
            format: 'PNG',
            maybePixels: Option.none(),
          },
        }),
      ),
      Command.expectHas(RunPipeline),
      model(nextModel => {
        expect(nextModel.source).toEqual(loadedSource)
        expect(nextModel.runId).toBe(1)
        expect(nextModel.preview).toEqual(
          expect.objectContaining({ _tag: 'Processing', runId: 1 }),
        )
      }),
      Command.resolve(
        RunPipeline,
        Message.FailedRunPipeline({ runId: 1, reason: 'unused' }),
      ),
    )
  })

  test('a stale pipeline result is ignored', () => {
    story(
      update,
      given({ ...initialModel, source: loadedSource, runId: 2 }),
      message(
        Message.CompletedRunPipeline({
          runId: 1,
          summary: readySummary(),
          stitches: new Uint8Array([0]),
        }),
      ),
      model(nextModel => {
        expect(nextModel.preview._tag).toBe('AwaitingSource')
      }),
    )
  })

  test('the current pipeline result becomes ready and syncs the preview', () => {
    story(
      update,
      given({ ...initialModel, source: loadedSource, runId: 2 }),
      message(
        Message.CompletedRunPipeline({
          runId: 2,
          summary: readySummary(),
          stitches: new Uint8Array([0, 1, 1, 0]),
        }),
      ),
      Command.resolve(SyncPreview, Message.CompletedSyncPreview()),
      model(nextModel => {
        expect(nextModel.preview._tag).toBe('Ready')
      }),
    )
  })

  test('ClickedStitch records the stitch lookup when a pattern is ready', () => {
    const readyModel: Model = {
      ...initialModel,
      source: loadedSource,
      runId: 2,
      preview: {
        _tag: 'Ready',
        runId: 2,
        summary: readySummary(),
        stitches: new Uint8Array([0, 1, 1, 0]),
      },
    }
    story(
      update,
      given(readyModel),
      message(Message.ClickedStitch({ x: 1, y: 1 })),
      model(nextModel => {
        expect(Option.getOrNull(nextModel.maybeStitchSelection)).toEqual(
          expect.objectContaining({
            x: 1,
            y: 1,
            symbol: 'A',
            flossNumber: 'C1',
          }),
        )
      }),
    )
  })

  test('a failed re-run keeps the last completed pattern and export stays available', () => {
    const readyModel: Model = {
      ...initialModel,
      source: loadedSource,
      runId: 2,
      preview: {
        _tag: 'Ready',
        runId: 2,
        summary: readySummary(),
        stitches: new Uint8Array([0, 1, 1, 0]),
      },
    }
    story(
      update,
      given(readyModel),
      message(
        Message.FailedRunPipeline({ runId: 2, reason: 'limits exceeded' }),
      ),
      model(nextModel => {
        expect(nextModel.preview._tag).toBe('Ready')
        expect(Option.getOrNull(nextModel.maybePipelineError)).toBe(
          'limits exceeded',
        )
      }),
      message(Message.ClickedExportPdf()),
      Command.expectHas(ExportPatternPdf),
      Command.resolve(ExportPatternPdf, Message.CompletedExportPdf()),
    )
  })

  test('ClickedZoomIn requests a zoom and the reported zoom updates the model', () => {
    story(
      update,
      given({ ...initialModel, source: loadedSource }),
      message(Message.ClickedZoomIn()),
      Command.expectHas(ZoomPreview),
      Command.resolve(ZoomPreview, Message.CompletedZoomPreview()),
      message(Message.ChangedPreviewZoom({ percent: 125 })),
      model(nextModel => {
        expect(nextModel.previewZoom).toBe(125)
      }),
    )
  })

  test('ClickedZoomOut requests a zoom out', () => {
    story(
      update,
      given({ ...initialModel, source: loadedSource }),
      message(Message.ClickedZoomOut()),
      Command.expectHas(ZoomPreview),
      Command.resolve(ZoomPreview, Message.CompletedZoomPreview()),
      model(nextModel => {
        expect(nextModel.previewZoom).toBe(100)
      }),
    )
  })

  test('custom colours are capped at the configured maximum', () => {
    const cappedPalette = {
      source: 'supplied' as const,
      entries: Array.makeBy(60, index => ({
        brand: 'Custom',
        number: `C${index + 1}`,
        name: `Colour ${index + 1}`,
        colour: { red: 10, green: 20, blue: 30 },
      })),
    }
    const cappedModel: Model = {
      ...initialModel,
      source: loadedSource,
      paletteMode: 'custom',
      maybeCustomPalette: Option.some(cappedPalette),
    }
    story(
      update,
      given(cappedModel),
      message(Message.AddedCustomColour({ hex: '#123456' })),
      Command.expectNone(),
      model(nextModel => {
        expect(
          Option.getOrNull(nextModel.maybeCustomPalette)?.entries.length,
        ).toBe(60)
      }),
    )
  })

  test('switching to a custom palette seeds colours once', () => {
    story(
      update,
      given({ ...initialModel, source: loadedSource }),
      message(Message.ChangedPaletteMode({ mode: 'custom' })),
      Command.expectHas(RunPipeline),
      model(nextModel => {
        expect(nextModel.paletteMode).toBe('custom')
        expect(
          Option.getOrNull(nextModel.maybeCustomPalette)?.entries.length,
        ).toBe(12)
      }),
      Command.resolve(
        RunPipeline,
        Message.FailedRunPipeline({ runId: 1, reason: 'unused' }),
      ),
    )
  })
})
