import { Context, Effect, Layer, Option, Schema } from 'effect'

import { CONVERTER_CONFIG } from '../converter/config'
import type { ImagePixels, RasterImage } from '../converter/model'
import { PixelStore } from './PixelStore'

export class UnsupportedImageFormat extends Schema.TaggedError<UnsupportedImageFormat>()(
  'UnsupportedImageFormat',
  { declaredFormat: Schema.String },
) {}

export class ImageDecodeFailure extends Schema.TaggedError<ImageDecodeFailure>()(
  'ImageDecodeFailure',
  { reason: Schema.String },
) {}

export class ImageTooLarge extends Schema.TaggedError<ImageTooLarge>()(
  'ImageTooLarge',
  { width: Schema.Int, height: Schema.Int },
) {}

export interface LoadedImage {
  readonly source: RasterImage
  readonly pixels: ImagePixels
}

export interface ImageLoaderService {
  readonly loadFile: (
    file: File,
    sourceId: string,
  ) => Effect.Effect<
    LoadedImage,
    UnsupportedImageFormat | ImageDecodeFailure | ImageTooLarge
  >
}

const formatFromMimeType = (mimeType: string): string | undefined => {
  const declared: string = mimeType.split('/')[1]?.toUpperCase() ?? ''
  if (declared === 'JPG' || declared === 'JPEG') {
    return 'JPEG'
  }
  if (CONVERTER_CONFIG.accepted_image_formats.includes(declared)) {
    return declared
  }
  return undefined
}

const detectTransparency = (data: Uint8Array): boolean => {
  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 255) < 255) {
      return true
    }
  }
  return false
}

const decodeFile = (
  file: File,
): Effect.Effect<ImagePixels, ImageDecodeFailure> =>
  Effect.tryPromise({
    try: async () => {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (context === null) {
        throw new Error('Canvas 2D context not available')
      }
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      return {
        width: imageData.width,
        height: imageData.height,
        data: new Uint8Array(imageData.data.buffer.slice(0)),
      }
    },
    catch: error =>
      ImageDecodeFailure.make({
        reason: error instanceof Error ? error.message : String(error),
      }),
  })

export class ImageLoader extends Context.Service<
  ImageLoader,
  ImageLoaderService
>()('ImageLoader') {
  static readonly layer: Layer.Layer<ImageLoader, never, PixelStore> =
    Layer.effect(
      ImageLoader,
      Effect.gen(function* () {
        const pixelStore = yield* PixelStore
        return {
          loadFile: (file, sourceId) =>
            Effect.gen(function* () {
              const declaredFormat = formatFromMimeType(file.type)
              if (declaredFormat === undefined) {
                return yield* Effect.fail(
                  UnsupportedImageFormat.make({
                    declaredFormat: file.type || 'unknown',
                  }),
                )
              }
              const pixels = yield* decodeFile(file)
              if (
                pixels.width > CONVERTER_CONFIG.max_source_side ||
                pixels.height > CONVERTER_CONFIG.max_source_side
              ) {
                return yield* Effect.fail(
                  ImageTooLarge.make({
                    width: pixels.width,
                    height: pixels.height,
                  }),
                )
              }
              yield* pixelStore.put(sourceId, pixels)
              const source: RasterImage = {
                width: pixels.width,
                height: pixels.height,
                hasTransparency: detectTransparency(pixels.data),
                format: declaredFormat,
                maybePixels: Option.none(),
              }
              return { source, pixels }
            }),
        }
      }),
    )
}
