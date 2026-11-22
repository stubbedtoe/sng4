import { Context, Effect, Layer, Ref } from 'effect'

import type { ImagePixels } from '../converter/model'

export interface PixelStoreService {
  readonly put: (sourceId: string, pixels: ImagePixels) => Effect.Effect<void>
  readonly get: (
    sourceId: string,
  ) => Effect.Effect<ImagePixels, SourcePixelsNotFound>
  readonly remove: (sourceId: string) => Effect.Effect<void>
}

export class SourcePixelsNotFound extends Error {
  readonly _tag = 'SourcePixelsNotFound'
  constructor(readonly sourceId: string) {
    super(`No pixels stored for source ${sourceId}`)
  }
}

export class PixelStore extends Context.Service<
  PixelStore,
  PixelStoreService
>()('PixelStore') {
  static readonly layer: Layer.Layer<PixelStore> = Layer.effect(
    PixelStore,
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<string, ImagePixels>())
      return {
        put: (sourceId, pixels) =>
          Ref.update(store, map => new Map(map).set(sourceId, pixels)),
        get: sourceId =>
          Effect.gen(function* () {
            const map = yield* Ref.get(store)
            const pixels = map.get(sourceId)
            if (pixels === undefined) {
              return yield* Effect.fail(new SourcePixelsNotFound(sourceId))
            }
            return pixels
          }),
        remove: sourceId =>
          Ref.update(store, map => {
            const next = new Map(map)
            next.delete(sourceId)
            return next
          }),
      }
    }),
  )
}
