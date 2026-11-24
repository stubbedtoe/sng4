import { Viewport } from 'pixi-viewport'
import { Application, Container, Sprite, Texture } from 'pixi.js'

import type { Colour, ImagePixels } from '../../converter/model'

export interface PatternRenderData {
  readonly width: number
  readonly height: number
  readonly stitches: Uint8Array
  readonly colours: ReadonlyArray<Colour>
}

export type PreviewDisplayMode = 'source' | 'pattern'

export interface PreviewHandle {
  readonly setSource: (pixels: ImagePixels, contentId: string) => void
  readonly setPattern: (data: PatternRenderData, contentId: string) => void
  readonly setMode: (mode: PreviewDisplayMode) => void
  readonly zoomBy: (factor: number) => void
  readonly fitWorld: () => void
  readonly destroy: () => void
}

const pixelsToCanvas = (pixels: ImagePixels): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = pixels.width
  canvas.height = pixels.height
  const context = canvas.getContext('2d')
  if (context === null) {
    return canvas
  }
  const imageData = new ImageData(
    new Uint8ClampedArray(pixels.data),
    pixels.width,
    pixels.height,
  )
  context.putImageData(imageData, 0, 0)
  return canvas
}

const patternToCanvas = (data: PatternRenderData): HTMLCanvasElement => {
  const { width, height, stitches, colours } = data
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context === null) {
    return canvas
  }
  const imageData = context.createImageData(width, height)
  for (let index = 0; index < width * height; index++) {
    const colour = colours[stitches[index] ?? 0]
    const offset = index * 4
    imageData.data[offset] = colour?.red ?? 0
    imageData.data[offset + 1] = colour?.green ?? 0
    imageData.data[offset + 2] = colour?.blue ?? 0
    imageData.data[offset + 3] = 255
  }
  context.putImageData(imageData, 0, 0)
  return canvas
}

export interface PreviewHostHooks {
  readonly onStitchClick: (x: number, y: number) => void
  readonly onZoomChange: (percent: number) => void
}

export const createPreviewHandle = (
  app: Application,
  viewport: Viewport,
  hooks: PreviewHostHooks,
): PreviewHandle => {
  const contentRoot = new Container()
  viewport.addChild(contentRoot)

  let baseSprite: Sprite | undefined
  let mode: PreviewDisplayMode = 'pattern'
  let patternData: PatternRenderData | undefined
  // identity of the loaded source; the source image and its derived pattern
  // share it, so switching between them is not a content change
  let lastContentId = ''
  let worldWidth = 1
  let worldHeight = 1
  // scale that fits the content to the canvas; the zoom readout is relative
  // to this (fit = 100%)
  let fitScale = 1
  let lastZoomPercent = 100

  const currentZoomPercent = () =>
    Math.max(1, Math.round((viewport.scale.x / fitScale) * 100))

  const notifyZoomChange = () => {
    const percent = currentZoomPercent()
    if (percent !== lastZoomPercent) {
      lastZoomPercent = percent
      hooks.onZoomChange(percent)
    }
  }

  // below 100% the content is smaller than the canvas: anchor its centre to
  // the canvas centre regardless of how the zoom got there
  const centerIfZoomedOut = () => {
    if (viewport.scale.x < fitScale) {
      viewport.moveCenter(worldWidth / 2, worldHeight / 2)
    }
  }

  viewport.on('zoomed', () => {
    centerIfZoomedOut()
    notifyZoomChange()
  })

  const setBaseTexture = (canvas: HTMLCanvasElement, nearest: boolean) => {
    const texture = Texture.from(canvas)
    if (nearest) {
      texture.source.scaleMode = 'nearest'
    }
    baseSprite?.destroy()
    baseSprite = new Sprite(texture)
    baseSprite.eventMode = 'none'
    contentRoot.addChildAt(baseSprite, 0)
  }

  const syncWorldSize = (width: number, height: number) => {
    worldWidth = Math.max(width, 1)
    worldHeight = Math.max(height, 1)
    viewport.resize(
      app.screen.width,
      app.screen.height,
      worldWidth,
      worldHeight,
    )
    fitScale = Math.max(
      Math.min(app.screen.width / worldWidth, app.screen.height / worldHeight),
      0.0001,
    )
  }

  // Rescale so the reported zoom percent holds against the current fit
  // scale, keeping the given world point at the viewport centre. Used when
  // the content changes shape but the zoom level must not (source <->
  // pattern switch, re-run) and when the canvas itself is resized (the
  // percent is relative to the fit scale, so 100% re-fits).
  const rescaleToPercent = (center: { x: number; y: number }) => {
    const scale = Math.min(
      120,
      Math.max(0.05, fitScale * (lastZoomPercent / 100)),
    )
    viewport.scale.set(scale)
    viewport.moveCenter(center)
  }

  // Swap content, then either fit (genuinely new content) or carry the
  // current zoom level and viewport centre across (source <-> pattern
  // switch, or a re-run of the same source).
  const applyContent = (contentId: string, syncSize: () => void) => {
    syncSize()
    if (contentId !== lastContentId) {
      lastContentId = contentId
      viewport.fitWorld(true)
    } else {
      rescaleToPercent(viewport.center)
    }
    notifyZoomChange()
  }

  const resizeObserver = new ResizeObserver(() => {
    const parent = app.canvas.parentElement
    if (parent === null) {
      return
    }
    app.renderer.resize(
      Math.max(1, parent.clientWidth),
      Math.max(1, parent.clientHeight),
    )
    viewport.resize(
      app.screen.width,
      app.screen.height,
      worldWidth,
      worldHeight,
    )
    fitScale = Math.max(
      Math.min(app.screen.width / worldWidth, app.screen.height / worldHeight),
      0.0001,
    )
    // no content yet (world is still the 1x1 placeholder): nothing to
    // rescale, and the placeholder fit scale would produce a bogus zoom
    if (lastContentId !== '') {
      rescaleToPercent(viewport.center)
    }
    notifyZoomChange()
  })
  if (app.canvas.parentElement !== null) {
    resizeObserver.observe(app.canvas.parentElement)
  }

  viewport.on('clicked', event => {
    if (mode !== 'pattern' || patternData === undefined) {
      return
    }
    const column = Math.floor(event.world.x)
    const row = Math.floor(event.world.y)
    if (
      column >= 0 &&
      column < patternData.width &&
      row >= 0 &&
      row < patternData.height
    ) {
      hooks.onStitchClick(column + 1, row + 1)
    }
  })

  return {
    setSource: (pixels, contentId) => {
      setBaseTexture(pixelsToCanvas(pixels), false)
      patternData = undefined
      applyContent(contentId, () => syncWorldSize(pixels.width, pixels.height))
    },

    setPattern: (data, contentId) => {
      patternData = data
      setBaseTexture(patternToCanvas(data), true)
      applyContent(contentId, () => syncWorldSize(data.width, data.height))
    },

    setMode: nextMode => {
      mode = nextMode
    },

    zoomBy: factor => {
      const center = viewport.center
      viewport.scale.set(viewport.scale.x * factor)
      if (viewport.scale.x < fitScale) {
        viewport.moveCenter(worldWidth / 2, worldHeight / 2)
      } else {
        viewport.moveCenter(center)
      }
      notifyZoomChange()
    },

    fitWorld: () => {
      viewport.fitWorld(true)
      notifyZoomChange()
    },

    destroy: () => {
      resizeObserver.disconnect()
      app.destroy(true)
    },
  }
}
