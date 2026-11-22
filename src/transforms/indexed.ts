import type { Colour, ImagePixels } from '../converter/model'
import { type Oklab, rgbToOklab } from '../domain/Colour'

export interface IndexedImage {
  readonly width: number
  readonly height: number
  readonly indices: Uint8Array
}

export interface PreparedPalette {
  readonly colours: ReadonlyArray<Colour>
  readonly oklab: ReadonlyArray<Oklab>
}

export const preparePalette = (
  colours: ReadonlyArray<Colour>,
): PreparedPalette => ({
  colours,
  oklab: colours.map(rgbToOklab),
})

export const nearestIndex = (
  target: Oklab,
  candidates: ReadonlyArray<Oklab>,
): number => {
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]
    if (candidate === undefined) {
      continue
    }
    const deltaL = target.l - candidate.l
    const deltaA = target.a - candidate.a
    const deltaB = target.b - candidate.b
    const distance = deltaL * deltaL + deltaA * deltaA + deltaB * deltaB
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

const pixelAt = (data: Uint8Array, offset: number): Oklab =>
  rgbToOklab({
    red: data[offset] ?? 0,
    green: data[offset + 1] ?? 0,
    blue: data[offset + 2] ?? 0,
  })

export const convertToIndexed = (
  pixels: ImagePixels,
  palette: PreparedPalette,
): IndexedImage => {
  const { width, height, data } = pixels
  const indices = new Uint8Array(width * height)

  for (let index = 0; index < width * height; index++) {
    indices[index] = nearestIndex(pixelAt(data, index * 4), palette.oklab)
  }

  return { width, height, indices }
}

const clampChannel = (value: number): number =>
  value < 0 ? 0 : value > 255 ? 255 : value

export const ditherToIndexed = (
  pixels: ImagePixels,
  palette: PreparedPalette,
): IndexedImage => {
  const { width, height, data } = pixels
  const indices = new Uint8Array(width * height)

  const errorRed = new Float64Array(width)
  const errorGreen = new Float64Array(width)
  const errorBlue = new Float64Array(width)
  const nextRed = new Float64Array(width)
  const nextGreen = new Float64Array(width)
  const nextBlue = new Float64Array(width)

  for (let y = 0; y < height; y++) {
    errorRed.set(nextRed)
    errorGreen.set(nextGreen)
    errorBlue.set(nextBlue)
    nextRed.fill(0)
    nextGreen.fill(0)
    nextBlue.fill(0)

    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const oldRed = clampChannel((data[offset] ?? 0) + (errorRed[x] ?? 0))
      const oldGreen = clampChannel(
        (data[offset + 1] ?? 0) + (errorGreen[x] ?? 0),
      )
      const oldBlue = clampChannel(
        (data[offset + 2] ?? 0) + (errorBlue[x] ?? 0),
      )

      const chosen = nearestIndex(
        rgbToOklab({ red: oldRed, green: oldGreen, blue: oldBlue }),
        palette.oklab,
      )
      indices[y * width + x] = chosen

      const match = palette.colours[chosen]
      const spreadRed = oldRed - (match?.red ?? 0)
      const spreadGreen = oldGreen - (match?.green ?? 0)
      const spreadBlue = oldBlue - (match?.blue ?? 0)

      if (x + 1 < width) {
        errorRed[x + 1] = (errorRed[x + 1] ?? 0) + (spreadRed * 7) / 16
        errorGreen[x + 1] = (errorGreen[x + 1] ?? 0) + (spreadGreen * 7) / 16
        errorBlue[x + 1] = (errorBlue[x + 1] ?? 0) + (spreadBlue * 7) / 16
      }
      if (y + 1 < height) {
        if (x > 0) {
          nextRed[x - 1] = (nextRed[x - 1] ?? 0) + (spreadRed * 3) / 16
          nextGreen[x - 1] = (nextGreen[x - 1] ?? 0) + (spreadGreen * 3) / 16
          nextBlue[x - 1] = (nextBlue[x - 1] ?? 0) + (spreadBlue * 3) / 16
        }
        nextRed[x] = (nextRed[x] ?? 0) + (spreadRed * 5) / 16
        nextGreen[x] = (nextGreen[x] ?? 0) + (spreadGreen * 5) / 16
        nextBlue[x] = (nextBlue[x] ?? 0) + (spreadBlue * 5) / 16
        if (x + 1 < width) {
          nextRed[x + 1] = (nextRed[x + 1] ?? 0) + spreadRed / 16
          nextGreen[x + 1] = (nextGreen[x + 1] ?? 0) + spreadGreen / 16
          nextBlue[x + 1] = (nextBlue[x + 1] ?? 0) + spreadBlue / 16
        }
      }
    }
  }

  return { width, height, indices }
}

export const renderIndexedPixels = (
  indexed: IndexedImage,
  colours: ReadonlyArray<Colour>,
): Uint8Array => {
  const { width, height, indices } = indexed
  const rendered = new Uint8Array(width * height * 4)

  for (let index = 0; index < width * height; index++) {
    const colour = colours[indices[index] ?? 0]
    const offset = index * 4
    rendered[offset] = colour?.red ?? 0
    rendered[offset + 1] = colour?.green ?? 0
    rendered[offset + 2] = colour?.blue ?? 0
    rendered[offset + 3] = 255
  }

  return rendered
}
