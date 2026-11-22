import { describe, expect, test } from 'vitest'

import { Colour } from '../converter/model'
import { convertToIndexed, ditherToIndexed, preparePalette } from './indexed'

// Fixture: 4x1 greyscale ramp. Palette indices are asserted exactly.
const greyRamp = (): Uint8Array =>
  new Uint8Array([
    0, 0, 0, 255, 85, 85, 85, 255, 170, 170, 170, 255, 255, 255, 255, 255,
  ])

const blackWhitePalette = preparePalette([
  Colour.make({ red: 0, green: 0, blue: 0 }),
  Colour.make({ red: 255, green: 255, blue: 255 }),
])

describe('convertToIndexed', () => {
  test('maps every pixel to the nearest palette colour exactly', () => {
    const indexed = convertToIndexed(
      { width: 4, height: 1, data: greyRamp() },
      blackWhitePalette,
    )
    expect(Array.from(indexed.indices)).toEqual([0, 0, 1, 1])
  })

  test('output uses only palette indices', () => {
    const indexed = convertToIndexed(
      { width: 4, height: 1, data: greyRamp() },
      blackWhitePalette,
    )
    expect(indexed.indices.every(index => index === 0 || index === 1)).toBe(
      true,
    )
  })

  test('conversion is deterministic', () => {
    const first = convertToIndexed(
      { width: 4, height: 1, data: greyRamp() },
      blackWhitePalette,
    )
    const second = convertToIndexed(
      { width: 4, height: 1, data: greyRamp() },
      blackWhitePalette,
    )
    expect(Array.from(second.indices)).toEqual(Array.from(first.indices))
  })
})

describe('ditherToIndexed', () => {
  test('diffuses quantisation error to the right and below', () => {
    const pixels = {
      width: 4,
      height: 1,
      data: new Uint8Array([
        128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255, 128, 128,
        128, 255,
      ]),
    }
    const indexed = ditherToIndexed(pixels, blackWhitePalette)
    // 128 snaps to white (255), pushing -127 error right: the next pixel
    // becomes ~1 which snaps to black, pushing +1 error onward.
    expect(Array.from(indexed.indices)).toEqual([1, 0, 1, 0])
  })

  test('behaves identically across runs', () => {
    const pixels = {
      width: 8,
      height: 4,
      data: new Uint8Array(8 * 4 * 4).map((_, index) =>
        index % 4 === 3 ? 255 : (index * 37) % 256,
      ),
    }
    const first = ditherToIndexed(pixels, blackWhitePalette)
    const second = ditherToIndexed(pixels, blackWhitePalette)
    expect(Array.from(second.indices)).toEqual(Array.from(first.indices))
  })

  test('clearly differs from no dithering on a smooth ramp', () => {
    const pixels = { width: 16, height: 16, data: gradientPixels(16, 16) }
    const plain = convertToIndexed(pixels, blackWhitePalette)
    const dithered = ditherToIndexed(pixels, blackWhitePalette)
    expect(Array.from(dithered.indices)).not.toEqual(Array.from(plain.indices))
    expect(dithered.indices.every(index => index === 0 || index === 1)).toBe(
      true,
    )
  })
})

const gradientPixels = (width: number, height: number): Uint8Array => {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = Math.round((x / (width - 1)) * 255)
      const offset = (y * width + x) * 4
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = value
      data[offset + 3] = 255
    }
  }
  return data
}
