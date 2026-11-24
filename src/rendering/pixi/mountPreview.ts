import { Effect, Option, Queue, Schema, Stream } from 'effect'
import { Mount } from 'foldkit'
import { Viewport } from 'pixi-viewport'
import { Application } from 'pixi.js'

import { Message } from '../../message'
import { createPreviewHandle } from './pixiHost'
import {
  getPreviewHandle,
  removePreviewHandle,
  setPreviewHandle,
} from './registry'

type MountMessage =
  | typeof Message.SucceededMountPreview.Type
  | typeof Message.FailedMountPreview.Type
  | typeof Message.ClickedStitch.Type
  | typeof Message.ChangedPreviewZoom.Type

const mountPreviewStream = (
  element: Element,
  hostId: string,
): Stream.Stream<MountMessage> =>
  Stream.callback<MountMessage>(queue =>
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.gen(function* () {
          // Suspend before the heavy synchronous WebGL bootstrap.
          // Foldkit acquires Mounts with a synchronous fork inside its
          // patch phase, so creating the Pixi Application here would
          // bill context creation and shader compilation to the patch
          // that inserted the canvas (slow-patch warnings on whatever
          // Message happened to mount the preview). Yielding once lets
          // that patch finish first; the canvas pops in a tick later.
          yield* Effect.yieldNow
          const app = new Application()
          yield* Effect.tryPromise({
            try: () =>
              app.init({
                antialias: true,
                autoDensity: true,
                resolution: globalThis.window.devicePixelRatio || 1,
                background: '#f8fafc',
              }),
            catch: error =>
              error instanceof Error ? error : new Error(String(error)),
          })
          element.appendChild(app.canvas)

          const viewport = new Viewport({
            screenWidth: Math.max(1, element.clientWidth),
            screenHeight: Math.max(1, element.clientHeight),
            worldWidth: 1,
            worldHeight: 1,
            events: app.renderer.events,
            ticker: app.ticker,
          })
          viewport
            .drag()
            .pinch()
            .wheel({ percent: 0.15, smooth: 3 })
            .decelerate()
            .clamp({ direction: 'all', underflow: 'center' })
            .clampZoom({ minScale: 0.05, maxScale: 120 })
          app.stage.addChild(viewport)

          const handle = createPreviewHandle(app, viewport, {
            onStitchClick: (x, y) => {
              Queue.offerUnsafe(queue, Message.ClickedStitch({ x, y }))
            },
            onZoomChange: percent => {
              Queue.offerUnsafe(queue, Message.ChangedPreviewZoom({ percent }))
            },
          })
          setPreviewHandle(hostId, handle)
          Queue.offerUnsafe(queue, Message.SucceededMountPreview())
        }).pipe(
          Effect.catch(error =>
            Effect.sync(() => {
              Queue.offerUnsafe(
                queue,
                Message.FailedMountPreview({
                  reason:
                    error instanceof Error ? error.message : String(error),
                }),
              )
            }),
          ),
        ),
        () =>
          Effect.sync(() => {
            const handle = getPreviewHandle(hostId)
            if (Option.isSome(handle)) {
              removePreviewHandle(hostId, handle.value)
              handle.value.destroy()
            }
          }),
      )
      return yield* Effect.never
    }),
  )

export const MountPreview = Mount.defineStream('MountPreview', {
  args: { hostId: Schema.String },
  messages: [
    Message.SucceededMountPreview,
    Message.FailedMountPreview,
    Message.ClickedStitch,
    Message.ChangedPreviewZoom,
  ],
  execute: ({ element, hostId }) => mountPreviewStream(element, hostId),
})
