import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import type { Palette } from '../converter/model'
import { buildPattern } from './pattern'
import { assignSymbols, symbolAt } from './symbols'

const floss = (number: string, red: number, green: number, blue: number) => ({
  brand: 'Custom',
  number,
  name: `Colour ${number}`,
  colour: { red, green, blue },
})

const palette: Palette = {
  source: 'supplied',
  entries: [floss('C1', 0, 0, 0), floss('C2', 255, 255, 255)],
}

describe('assignSymbols', () => {
  test('assigns a unique symbol per colour', () => {
    const symbols = assignSymbols(palette.entries)
    expect(symbols.map(entry => entry.symbol)).toEqual(['A', 'B'])
    expect(new Set(symbols.map(entry => entry.symbol)).size).toBe(
      symbols.length,
    )
  })

  test('covers the maximum colour count with distinct symbols', () => {
    const entries = Array.from({ length: 60 }, (_, index) =>
      floss(`C${index + 1}`, index, index, index),
    )
    const symbols = assignSymbols(entries).map(entry => entry.symbol)
    expect(new Set(symbols).size).toBe(60)
  })
})

describe('buildPattern', () => {
  const indexed = {
    width: 2,
    height: 2,
    indices: new Uint8Array([0, 1, 1, 0]),
  }

  test('builds one 1-based cell per stitch with palette references', () => {
    const pattern = buildPattern({ indexed, palette, fabricCount: 14 })
    expect(pattern.cells).toHaveLength(4)
    expect(pattern.cells[0]).toMatchObject({ x: 1, y: 1, symbol: 'A' })
    expect(pattern.cells[1]).toMatchObject({ x: 2, y: 1, symbol: 'B' })
    expect(pattern.cells[2]).toMatchObject({ x: 1, y: 2, symbol: 'B' })
    expect(pattern.cells[3]).toMatchObject({ x: 2, y: 2, symbol: 'A' })
    expect(pattern.cells.every(cell => cell.floss.brand === 'Custom')).toBe(
      true,
    )
  })

  test('carries dimensions, key, and usage that sums to the grid', () => {
    const pattern = buildPattern({ indexed, palette, fabricCount: 14 })
    expect(pattern.stitchDimensions).toEqual({ width: 2, height: 2 })
    expect(pattern.key.map(entry => entry.symbol)).toEqual(['A', 'B'])
    const total = pattern.usage.reduce((sum, u) => sum + u.stitchCount, 0)
    expect(total).toBe(4)
    expect(
      pattern.usage.map(usage => [usage.floss.number, usage.stitchCount]),
    ).toEqual([
      ['C1', 2],
      ['C2', 2],
    ])
  })

  test('renders preview pixels from the palette colours', () => {
    const pattern = buildPattern({ indexed, palette, fabricCount: 14 })
    expect(Option.isSome(pattern.preview.maybePixels)).toBe(true)
    const previewPixels = Option.getOrThrow(pattern.preview.maybePixels)
    expect(previewPixels.width).toBe(2)
    expect(previewPixels.height).toBe(2)
    // first pixel is palette colour 0 (black)
    expect(previewPixels.data[0]).toBe(0)
    expect(previewPixels.data[1]).toBe(0)
    expect(previewPixels.data[2]).toBe(0)
  })

  test('finished dimensions follow the fabric count', () => {
    const pattern = buildPattern({ indexed, palette, fabricCount: 14 })
    expect(pattern.finishedDimensions.widthIn).toBeCloseTo(2 / 14, 3)
    expect(pattern.finishedDimensions.heightCm).toBeCloseTo((2 / 14) * 2.54, 3)
  })
})

describe('symbolAt', () => {
  test('falls back to a placeholder beyond the symbol set', () => {
    expect(symbolAt(0)).toBe('A')
    expect(symbolAt(61)).toBe('9')
    expect(symbolAt(62)).toBe('?')
  })
})
