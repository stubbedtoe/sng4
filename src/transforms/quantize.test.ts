import { describe, expect, test } from 'vitest'

import type { ImagePixels } from '../converter/model'
import { quantize } from './quantize'

const solidPixels = (
  width: number,
  height: number,
  colours: ReadonlyArray<readonly [number, number, number]>,
): ImagePixels => {
  const data = new Uint8Array(width * height * 4)
  for (let index = 0; index < width * height; index++) {
    const colour = colours[index % colours.length] ?? [0, 0, 0]
    const offset = index * 4
    data[offset] = colour[0] ?? 0
    data[offset + 1] = colour[1] ?? 0
    data[offset + 2] = colour[2] ?? 0
    data[offset + 3] = 255
  }
  return { width, height, data }
}

describe('quantize', () => {
  test('extracts one representative colour per dominant colour', () => {
    const pixels = solidPixels(2, 1, [
      [255, 0, 0],
      [0, 0, 255],
    ])
    const palette = quantize(pixels, 2)
    expect(palette).toHaveLength(2)
    const hexes = palette.map(
      colour => `${colour.red},${colour.green},${colour.blue}`,
    )
    expect(hexes).toContain('255,0,0')
    expect(hexes).toContain('0,0,255')
  })

  test('is deterministic for the same input and count', () => {
    const pixels = solidPixels(6, 4, [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
    ])
    const first = quantize(pixels, 4)
    const second = quantize(pixels, 4)
    expect(second).toEqual(first)
  })

  test('caps the palette at the requested count', () => {
    const pixels = solidPixels(8, 8, [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
      [0, 255, 255],
      [255, 0, 255],
    ])
    expect(quantize(pixels, 3)).toHaveLength(3)
  })

  test('returns an empty palette for a zero count', () => {
    expect(quantize(solidPixels(1, 1, [[0, 0, 0]]), 0)).toEqual([])
  })
})
