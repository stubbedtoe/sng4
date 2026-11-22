import { Viewport } from 'pixi-viewport'
import { Application, Container, Sprite, Texture } from 'pixi.js'

import type { Colour, ImagePixels } from '../../converter/model'

export interface PatternRenderData {
  readonly width: number
  readonly height: number
  readonly stitches: Uint8Array
  readonly colours: ReadonlyArray<Colour>
  readonly symbols: ReadonlyArray<string>
}

export type PreviewDisplayMode = 'source' | 'pattern'

export interface PreviewHandle {
  readonly setSource: (pixels: ImagePixels) => void
  readonly setPattern: (data: PatternRenderData) => void
  readonly setMode: (mode: PreviewDisplayMode) => void
  readonly fitWorld: () => void
  readonly destroy: () => void
}

const MAX_OVERLAY_DIMENSION = 4096

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
}

export const createPreviewHandle = (
  app: Application,
  viewport: Viewport,
  hooks: PreviewHostHooks,
): PreviewHandle => {
  const contentRoot = new Container()
  viewport.addChild(contentRoot)

  const overlayCanvas = document.createElement('canvas')
  const overlayTexture = Texture.from(overlayCanvas)
  const overlaySprite = new Sprite(overlayTexture)
  overlaySprite.eventMode = 'none'
  overlaySprite.visible = false
  viewport.addChild(overlaySprite)

  let baseSprite: Sprite | undefined
  let mode: PreviewDisplayMode = 'pattern'
  let patternData: PatternRenderData | undefined
  let contentKey = ''
  let worldWidth = 1
  let worldHeight = 1
  let overlayDirty = true

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
  }

  const redrawOverlay = () => {
    overlayDirty = false
    if (mode !== 'pattern' || patternData === undefined) {
      overlaySprite.visible = false
      return
    }

    const bounds = viewport.getVisibleBounds()
    const scale = viewport.scale.x
    const resolution = app.renderer.resolution
    const canvasWidth = Math.max(
      16,
      Math.min(
        MAX_OVERLAY_DIMENSION,
        Math.ceil(bounds.width * scale * resolution),
      ),
    )
    const canvasHeight = Math.max(
      16,
      Math.min(
        MAX_OVERLAY_DIMENSION,
        Math.ceil(bounds.height * scale * resolution),
      ),
    )
    overlayCanvas.width = canvasWidth
    overlayCanvas.height = canvasHeight
    const context = overlayCanvas.getContext('2d')
    if (context === null) {
      overlaySprite.visible = false
      return
    }
    context.clearRect(0, 0, canvasWidth, canvasHeight)

    const pixelsPerUnit: number = canvasWidth / Math.max(bounds.width, 0.0001)
    const toCanvasX = (worldX: number) => (worldX - bounds.x) * pixelsPerUnit
    const toCanvasY = (worldY: number) => (worldY - bounds.y) * pixelsPerUnit
    const { width, height, symbols } = patternData
    const cellPx = pixelsPerUnit

    const minorStep = cellPx >= 7 ? 1 : 10
    const firstColumn = Math.max(0, Math.floor(bounds.x))
    const lastColumn = Math.min(width, Math.ceil(bounds.x + bounds.width))
    const firstRow = Math.max(0, Math.floor(bounds.y))
    const lastRow = Math.min(height, Math.ceil(bounds.y + bounds.height))

    for (let column = firstColumn; column <= lastColumn; column++) {
      if (column % minorStep !== 0 && column % 10 !== 0) {
        continue
      }
      context.strokeStyle =
        column % 10 === 0 ? 'rgba(15, 23, 42, 0.5)' : 'rgba(15, 23, 42, 0.16)'
      context.lineWidth = column % 10 === 0 ? 1.4 : 1
      context.beginPath()
      context.moveTo(toCanvasX(column), 0)
      context.lineTo(toCanvasX(column), canvasHeight)
      context.stroke()
    }
    for (let row = firstRow; row <= lastRow; row++) {
      if (row % minorStep !== 0 && row % 10 !== 0) {
        continue
      }
      context.strokeStyle =
        row % 10 === 0 ? 'rgba(15, 23, 42, 0.5)' : 'rgba(15, 23, 42, 0.16)'
      context.lineWidth = row % 10 === 0 ? 1.4 : 1
      context.beginPath()
      context.moveTo(0, toCanvasY(row))
      context.lineTo(canvasWidth, toCanvasY(row))
      context.stroke()
    }

    if (cellPx >= 13) {
      context.fillStyle = 'rgba(15, 23, 42, 0.82)'
      context.font = `${Math.max(8, Math.floor(cellPx * 0.58))}px ui-monospace, Menlo, monospace`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const { stitches } = patternData
      for (let row = firstRow; row < lastRow; row++) {
        for (let column = firstColumn; column < lastColumn; column++) {
          const colourIndex = stitches[row * width + column]
          const symbol =
            colourIndex === undefined ? undefined : symbols[colourIndex]
          if (symbol === undefined) {
            continue
          }
          context.fillText(
            symbol,
            toCanvasX(column + 0.5),
            toCanvasY(row + 0.52),
          )
        }
      }
    }

    overlaySprite.visible = true
    overlaySprite.position.set(bounds.x, bounds.y)
    overlaySprite.width = bounds.width
    overlaySprite.height = bounds.height
    overlayTexture.source.update()
  }

  app.ticker.add(() => {
    if (overlayDirty) {
      redrawOverlay()
    }
  })

  viewport.on('moved', () => {
    overlayDirty = true
  })
  viewport.on('zoomed', () => {
    overlayDirty = true
  })

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
    overlayDirty = true
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
    setSource: pixels => {
      setBaseTexture(pixelsToCanvas(pixels), false)
      syncWorldSize(pixels.width, pixels.height)
      patternData = undefined
      const key = `source:${pixels.width}x${pixels.height}`
      if (key !== contentKey) {
        contentKey = key
        viewport.fitWorld(true)
      }
      overlayDirty = true
    },

    setPattern: data => {
      patternData = data
      setBaseTexture(patternToCanvas(data), true)
      syncWorldSize(data.width, data.height)
      const key = `pattern:${data.width}x${data.height}`
      if (key !== contentKey) {
        contentKey = key
        viewport.fitWorld(true)
      }
      overlayDirty = true
    },

    setMode: nextMode => {
      mode = nextMode
      overlayDirty = true
    },

    fitWorld: () => {
      viewport.fitWorld(true)
      overlayDirty = true
    },

    destroy: () => {
      resizeObserver.disconnect()
      app.destroy(true)
    },
  }
}
