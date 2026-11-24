import { Duration, Effect, Match, Option, Schema } from 'effect'
import { SecureRandom } from 'effect/crypto'
import { Command } from 'foldkit'

import { CONVERTER_CONFIG } from './converter/config'
import { Palette } from './converter/model'
import { Project } from './domain/Transformation'
import { Message } from './message'
import { summaryFromPattern } from './model'
import { getPreviewHandle } from './rendering/pixi/registry'
import {
  ImageDecodeFailure,
  ImageLoader,
  ImageTooLarge,
  UnsupportedImageFormat,
} from './services/ImageLoader'
import { PdfService } from './services/PdfService'
import type { PipelineError } from './services/Pipeline'
import { Pipeline } from './services/Pipeline'
import { PixelStore } from './services/PixelStore'

type ImageLoadError =
  | UnsupportedImageFormat
  | ImageDecodeFailure
  | ImageTooLarge

const describeImageError = (error: ImageLoadError): string =>
  Match.value(error).pipe(
    Match.tag(
      'UnsupportedImageFormat',
      ({ declaredFormat }) =>
        `Unsupported image format "${declaredFormat}". Use JPEG, PNG, or WebP.`,
    ),
    Match.tag(
      'ImageDecodeFailure',
      ({ reason }) => `Could not decode the image: ${reason}`,
    ),
    Match.tag(
      'ImageTooLarge',
      ({ width, height }) =>
        `Image is ${width} × ${height}px; the limit is ${CONVERTER_CONFIG.max_source_side}px per side.`,
    ),
    Match.exhaustive,
  )

export const LoadImageFile = Command.define('LoadImageFile', {
  args: { file: Schema.File },
  messages: [Message.CompletedLoadImage, Message.FailedLoadImage],
  execute: ({ file }) =>
    Effect.gen(function* () {
      const loader = yield* ImageLoader
      const secureRandom = yield* SecureRandom.SecureRandom
      const sourceId = yield* secureRandom.uuidV4()
      const loaded = yield* loader.loadFile(file, sourceId)
      return Message.CompletedLoadImage({
        sourceId,
        name: file.name,
        image: loaded.source,
      })
    }).pipe(
      Effect.catch(error =>
        Effect.succeed(
          Message.FailedLoadImage({ reason: describeImageError(error) }),
        ),
      ),
    ),
})

const describePipelineError = (error: PipelineError): string =>
  Match.value(error).pipe(
    Match.tag(
      'NoPatternTransformation',
      () => 'The project has no pattern stage.',
    ),
    Match.tag(
      'NoIndexedImage',
      () => 'The project has no palette mapping stage.',
    ),
    Match.tag('ProjectExceedsLimits', ({ reason }) => reason),
    Match.tag(
      'SourcePixelsNotFound',
      () => 'The source image data is no longer available.',
    ),
    Match.exhaustive,
  )

export const RunPipeline = Command.define('RunPipeline', {
  args: { runId: Schema.Int, project: Project },
  messages: [Message.CompletedRunPipeline, Message.FailedRunPipeline],
  execute: ({ runId, project }) =>
    Effect.sleep(Duration.millis(120)).pipe(
      Effect.andThen(
        Effect.gen(function* () {
          const pipeline = yield* Pipeline
          const output = yield* pipeline.evaluate(project)
          return Message.CompletedRunPipeline({
            runId,
            summary: summaryFromPattern(output.pattern),
            stitches: output.stitches,
          })
        }),
      ),
      Effect.catch(error =>
        Effect.succeed(
          Message.FailedRunPipeline({
            runId,
            reason: describePipelineError(error),
          }),
        ),
      ),
    ),
})

const PreviewSyncData = Schema.Struct({
  stitches: Schema.Uint8Array,
  width: Schema.Int,
  height: Schema.Int,
  palette: Palette,
  // identity of the loaded source; shared with the source-image view so
  // switching modes does not count as new content
  contentId: Schema.String,
})

export const SyncPreview = Command.define('SyncPreview', {
  args: {
    hostId: Schema.String,
    mode: Schema.Literals(['source', 'pattern']),
    maybeSourceId: Schema.Option(Schema.String),
    maybePattern: Schema.Option(PreviewSyncData),
  },
  messages: [Message.CompletedSyncPreview],
  execute: ({ hostId, mode, maybeSourceId, maybePattern }) =>
    Effect.gen(function* () {
      const handle = getPreviewHandle(hostId)
      if (Option.isNone(handle)) {
        return Message.CompletedSyncPreview()
      }
      if (mode === 'pattern') {
        yield* Option.match(maybePattern, {
          onNone: () => Effect.void,
          onSome: data =>
            Effect.sync(() =>
              handle.value.setPattern(
                {
                  width: data.width,
                  height: data.height,
                  stitches: data.stitches,
                  colours: data.palette.entries.map(entry => entry.colour),
                },
                data.contentId,
              ),
            ),
        })
      } else {
        const pixelStore = yield* PixelStore
        yield* Option.match(maybeSourceId, {
          onNone: () => Effect.void,
          onSome: sourceId =>
            Effect.gen(function* () {
              const pixels = yield* pixelStore.get(sourceId)
              yield* Effect.sync(() => handle.value.setSource(pixels, sourceId))
            }).pipe(Effect.catch(() => Effect.void)),
        })
      }
      return Message.CompletedSyncPreview()
    }),
})

export const ZoomPreview = Command.define('ZoomPreview', {
  args: { hostId: Schema.String, factor: Schema.Number },
  messages: [Message.CompletedZoomPreview],
  execute: ({ hostId, factor }) =>
    Effect.gen(function* () {
      const handle = getPreviewHandle(hostId)
      if (Option.isSome(handle)) {
        yield* Effect.sync(() => handle.value.zoomBy(factor))
      }
      return Message.CompletedZoomPreview()
    }),
})

export const FitPreview = Command.define('FitPreview', {
  args: { hostId: Schema.String },
  messages: [Message.CompletedFitPreview],
  execute: ({ hostId }) =>
    Effect.gen(function* () {
      const handle = getPreviewHandle(hostId)
      if (Option.isSome(handle)) {
        yield* Effect.sync(() => handle.value.fitWorld())
      }
      return Message.CompletedFitPreview()
    }),
})

export const ExportPatternPdf = Command.define('ExportPatternPdf', {
  args: { title: Schema.String, project: Project },
  messages: [Message.CompletedExportPdf, Message.FailedExportPdf],
  execute: ({ title, project }) =>
    Effect.gen(function* () {
      // The Model keeps only a PatternSummary, so the full Pattern (cells and
      // preview pixels) is re-derived here. The project is unchanged since the
      // run that produced it, so this is a guaranteed pipeline cache hit.
      const pipeline = yield* Pipeline
      const { pattern } = yield* pipeline.evaluate(project)
      const pdfService = yield* PdfService
      const bytes = yield* pdfService.generatePatternPdf(pattern, title)
      const blob = new Blob([new Uint8Array(bytes)], {
        type: 'application/pdf',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const safeTitle = title.trim()
      anchor.href = url
      anchor.download = `${safeTitle === '' ? 'cross-stitch-pattern' : safeTitle}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      return Message.CompletedExportPdf()
    }).pipe(
      Effect.catch(error =>
        Effect.succeed(
          Message.FailedExportPdf({
            reason:
              'reason' in error
                ? error.reason
                : 'The pattern could not be rebuilt for export.',
          }),
        ),
      ),
    ),
})
