import { Effect, Option } from 'effect'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, test } from 'vitest'

import type { Pattern } from '../converter/model'
import { PdfService } from './PdfService'

const floss = (number: string, red: number, green: number, blue: number) => ({
  brand: 'Custom',
  number,
  name: `Colour ${number}`,
  colour: { red, green, blue },
})

const makePattern = (width: number, height: number): Pattern => {
  const palette = [floss('C1', 0, 0, 0), floss('C2', 255, 255, 255)]
  const cells = []
  for (let y = 1; y <= height; y++) {
    for (let x = 1; x <= width; x++) {
      cells.push({
        x,
        y,
        symbol: (x + y) % 2 === 0 ? 'A' : 'B',
        floss: (x + y) % 2 === 0 ? palette[0]! : palette[1]!,
      })
    }
  }
  return {
    stitchDimensions: { width, height },
    finishedDimensions: {
      widthIn: width / 14,
      heightIn: height / 14,
      widthCm: (width / 14) * 2.54,
      heightCm: (height / 14) * 2.54,
    },
    estimateBasis: { fabricCount: 14, strands: 2, skeinLengthM: 8 },
    suggestedFabric: { count: 14, cutWidthCm: 20, cutHeightCm: 20 },
    preview: {
      width,
      height,
      hasTransparency: false,
      format: 'PNG',
      maybePixels: Option.none(),
    },
    cells,
    key: [
      { symbol: 'A', floss: palette[0]! },
      { symbol: 'B', floss: palette[1]! },
    ],
    usage: [
      {
        floss: palette[0]!,
        stitchCount: Math.ceil(cells.length / 2),
        skeins: 1,
      },
      {
        floss: palette[1]!,
        stitchCount: Math.floor(cells.length / 2),
        skeins: 1,
      },
    ],
    palette: { source: 'supplied', entries: palette },
  }
}

const generate = (pattern: Pattern) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* PdfService
      return yield* service.generatePatternPdf(pattern, 'Test Pattern')
    }).pipe(Effect.provide(PdfService.layer)),
  )

describe('PdfService', () => {
  test('generates a valid PDF with a summary page and one grid page for a small pattern', async () => {
    const bytes = await generate(makePattern(20, 20))
    expect(bytes.length).toBeGreaterThan(1000)
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')

    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
  })

  test('paginates large grids across multiple pages', async () => {
    const bytes = await generate(makePattern(300, 200))
    const doc = await PDFDocument.load(bytes)
    const pageCount = doc.getPageCount()
    expect(pageCount).toBeGreaterThan(4)
    expect(pageCount).toBeLessThan(20)
  })

  test('generation is deterministic for the same pattern', async () => {
    const pattern = makePattern(30, 30)
    const first = await generate(pattern)
    const second = await generate(pattern)
    expect(second.length).toBe(first.length)
  })
})
