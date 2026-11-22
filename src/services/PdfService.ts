import { Context, Effect, Layer, Schema } from 'effect'
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib'

import type { Pattern } from '../converter/model'

export class PdfGenerationError extends Schema.TaggedError<PdfGenerationError>()(
  'PdfGenerationError',
  { reason: Schema.String },
) {}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const PAGE_MARGIN = 40
const GRID_LINE_LIGHT = 0.25
const GRID_LINE_HEAVY = 1.1
const GRID_OVERLAP_STITCHES = 2
const COLOUR_SWATCH_SIZE = 12

interface KeyColumnWidths {
  readonly symbol: number
  readonly swatch: number
  readonly name: number
  readonly number: number
  readonly stitches: number
  readonly skeins: number
}

const KEY_COLUMNS: KeyColumnWidths = {
  symbol: 30,
  swatch: COLOUR_SWATCH_SIZE + 8,
  name: 200,
  number: 60,
  stitches: 70,
  skeins: 60,
}

const hexToRgbFraction = (hex: string) => {
  const value = hex.replace('#', '')
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  )
}

const colourToHex = (colour: {
  red: number
  green: number
  blue: number
}): string => {
  const toHex = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(colour.red)}${toHex(colour.green)}${toHex(colour.blue)}`
}

const gridSymbols = (pattern: Pattern): ReadonlyArray<string> => {
  const { width, height } = pattern.stitchDimensions
  const grid = new Array<string>(width * height).fill('')
  for (const cell of pattern.cells) {
    grid[(cell.y - 1) * width + (cell.x - 1)] = cell.symbol
  }
  return grid
}

interface PdfContext {
  readonly doc: PDFDocument
  readonly font: PDFFont
  readonly boldFont: PDFFont
}

const drawSummaryPage = (
  { doc, font, boldFont }: PdfContext,
  pattern: Pattern,
  title: string,
): void => {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let cursorY = PAGE_HEIGHT - PAGE_MARGIN

  page.drawText(title, {
    x: PAGE_MARGIN,
    y: cursorY - 20,
    size: 22,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.15),
  })
  cursorY -= 52

  const { width, height } = pattern.stitchDimensions
  const lines = [
    `${width} × ${height} stitches (${pattern.cells.length} total)`,
    `Finished size: ${pattern.finishedDimensions.widthIn.toFixed(1)} × ${pattern.finishedDimensions.heightIn.toFixed(1)} in (${pattern.finishedDimensions.widthCm.toFixed(1)} × ${pattern.finishedDimensions.heightCm.toFixed(1)} cm) on ${pattern.estimateBasis.fabricCount}-count aida`,
    `Floss estimate basis: ${pattern.estimateBasis.strands} strands, ${pattern.estimateBasis.skeinLengthM} m skeins`,
    `Suggested fabric: ${pattern.suggestedFabric.count}-count aida, cut ${pattern.suggestedFabric.cutWidthCm.toFixed(1)} × ${pattern.suggestedFabric.cutHeightCm.toFixed(1)} cm`,
  ]
  for (const line of lines) {
    page.drawText(line, {
      x: PAGE_MARGIN,
      y: cursorY - 12,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.25),
    })
    cursorY -= 18
  }
  cursorY -= 12

  page.drawText('Palette key', {
    x: PAGE_MARGIN,
    y: cursorY - 14,
    size: 14,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.15),
  })
  cursorY -= 34

  const usageByFloss = new Map(
    pattern.usage.map(usage => [
      `${usage.floss.brand}:${usage.floss.number}`,
      usage,
    ]),
  )

  const keyStartY = cursorY
  const usageFor = (keyEntry: Pattern['key'][number]) =>
    usageByFloss.get(`${keyEntry.floss.brand}:${keyEntry.floss.number}`)

  pattern.key.forEach((keyEntry, index) => {
    const rowY = keyStartY - index * 20
    if (rowY < PAGE_MARGIN) {
      return
    }
    const usage = usageFor(keyEntry)
    page.drawText(keyEntry.symbol, {
      x: PAGE_MARGIN,
      y: rowY - 10,
      size: 11,
      font: boldFont,
    })
    page.drawRectangle({
      x: PAGE_MARGIN + KEY_COLUMNS.symbol,
      y: rowY - COLOUR_SWATCH_SIZE,
      width: COLOUR_SWATCH_SIZE,
      height: COLOUR_SWATCH_SIZE,
      color: hexToRgbFraction(colourToHex(keyEntry.floss.colour)),
      borderColor: rgb(0.7, 0.7, 0.75),
      borderWidth: 0.5,
    })
    page.drawText(keyEntry.floss.name, {
      x: PAGE_MARGIN + KEY_COLUMNS.symbol + KEY_COLUMNS.swatch,
      y: rowY - 10,
      size: 10,
      font,
    })
    page.drawText(`${keyEntry.floss.brand} ${keyEntry.floss.number}`, {
      x:
        PAGE_MARGIN +
        KEY_COLUMNS.symbol +
        KEY_COLUMNS.swatch +
        KEY_COLUMNS.name,
      y: rowY - 10,
      size: 10,
      font,
    })
    page.drawText(String(usage?.stitchCount ?? 0), {
      x:
        PAGE_MARGIN +
        KEY_COLUMNS.symbol +
        KEY_COLUMNS.swatch +
        KEY_COLUMNS.name +
        KEY_COLUMNS.number,
      y: rowY - 10,
      size: 10,
      font,
    })
    page.drawText(
      `${usage?.skeins ?? 1} skein${(usage?.skeins ?? 1) === 1 ? '' : 's'}`,
      {
        x:
          PAGE_MARGIN +
          KEY_COLUMNS.symbol +
          KEY_COLUMNS.swatch +
          KEY_COLUMNS.name +
          KEY_COLUMNS.number +
          KEY_COLUMNS.stitches,
        y: rowY - 10,
        size: 10,
        font,
      },
    )
  })
}

interface GridPagePlan {
  readonly pageIndexX: number
  readonly pageIndexY: number
  readonly startX: number
  readonly startY: number
  readonly columns: number
  readonly rows: number
}

interface GridLayout {
  readonly cellSize: number
  readonly columnsPerPage: number
  readonly rowsPerPage: number
  readonly originX: number
  readonly originY: number
  readonly pagesX: number
  readonly pagesY: number
  readonly plans: ReadonlyArray<GridPagePlan>
  readonly totalPages: number
}

const GRID_LABEL_SIZE = 9
const GRID_HEADER_HEIGHT = 30

const planGridLayout = (pattern: Pattern, cellSize: number): GridLayout => {
  const { width, height } = pattern.stitchDimensions
  const availableWidth = PAGE_WIDTH - 2 * PAGE_MARGIN - GRID_LABEL_SIZE - 6
  const availableHeight =
    PAGE_HEIGHT - 2 * PAGE_MARGIN - GRID_HEADER_HEIGHT - GRID_LABEL_SIZE - 6

  const columnsPerPage = Math.max(1, Math.floor(availableWidth / cellSize))
  const rowsPerPage = Math.max(1, Math.floor(availableHeight / cellSize))

  const stepX = Math.max(1, columnsPerPage - GRID_OVERLAP_STITCHES)
  const stepY = Math.max(1, rowsPerPage - GRID_OVERLAP_STITCHES)
  const pagesX = Math.max(
    1,
    Math.ceil(Math.max(1, width - GRID_OVERLAP_STITCHES) / stepX),
  )
  const pagesY = Math.max(
    1,
    Math.ceil(Math.max(1, height - GRID_OVERLAP_STITCHES) / stepY),
  )

  const plans: Array<GridPagePlan> = []
  for (let pageIndexY = 0; pageIndexY < pagesY; pageIndexY++) {
    for (let pageIndexX = 0; pageIndexX < pagesX; pageIndexX++) {
      plans.push({
        pageIndexX,
        pageIndexY,
        startX: pageIndexX * stepX,
        startY: pageIndexY * stepY,
        columns: Math.min(columnsPerPage, width - pageIndexX * stepX),
        rows: Math.min(rowsPerPage, height - pageIndexY * stepY),
      })
    }
  }

  return {
    cellSize,
    columnsPerPage,
    rowsPerPage,
    originX: PAGE_MARGIN + GRID_LABEL_SIZE + 6,
    originY:
      PAGE_HEIGHT - PAGE_MARGIN - GRID_HEADER_HEIGHT - GRID_LABEL_SIZE - 6,
    pagesX,
    pagesY,
    plans,
    totalPages: plans.length,
  }
}

const chooseCellSize = (pattern: Pattern): number => {
  const { width, height } = pattern.stitchDimensions
  const availableWidth = PAGE_WIDTH - 2 * PAGE_MARGIN - GRID_LABEL_SIZE - 6
  const availableHeight =
    PAGE_HEIGHT - 2 * PAGE_MARGIN - GRID_HEADER_HEIGHT - GRID_LABEL_SIZE - 6
  for (const candidate of [14, 12, 10, 8, 6, 4]) {
    const columns = Math.floor(availableWidth / candidate)
    const rows = Math.floor(availableHeight / candidate)
    if (columns >= width && rows >= height) {
      return candidate
    }
  }
  return 4
}

const drawGridPage = (
  { doc, font, boldFont }: PdfContext,
  pattern: Pattern,
  title: string,
  layout: GridLayout,
  plan: GridPagePlan,
  pageNumber: number,
  totalPages: number,
  symbols: ReadonlyArray<string>,
): void => {
  const page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const { width: patternWidth } = pattern.stitchDimensions
  const { cellSize, originX, originY } = layout

  page.drawText(
    `${title} — rows ${plan.startY + 1}-${plan.startY + plan.rows}, columns ${plan.startX + 1}-${plan.startX + plan.columns}`,
    {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - PAGE_MARGIN - 12,
      size: 11,
      font: boldFont,
    },
  )
  page.drawText(`Page ${pageNumber} of ${totalPages}`, {
    x: PAGE_WIDTH - PAGE_MARGIN - 90,
    y: PAGE_MARGIN - 18,
    size: 9,
    font,
  })

  const gridWidth = plan.columns * cellSize
  const gridHeight = plan.rows * cellSize
  const gridBottom = originY - gridHeight

  for (let line = 0; line <= plan.columns; line++) {
    const absoluteX = plan.startX + line
    const isHeavy = absoluteX % 10 === 0 || line === plan.columns
    page.drawLine({
      start: { x: originX + line * cellSize, y: originY },
      end: { x: originX + line * cellSize, y: gridBottom },
      thickness: isHeavy ? GRID_LINE_HEAVY : GRID_LINE_LIGHT,
      color: rgb(0.55, 0.55, 0.6),
    })
  }
  for (let line = 0; line <= plan.rows; line++) {
    const absoluteY = plan.startY + line
    const isHeavy = absoluteY % 10 === 0 || line === plan.rows
    page.drawLine({
      start: { x: originX, y: originY - line * cellSize },
      end: { x: originX + gridWidth, y: originY - line * cellSize },
      thickness: isHeavy ? GRID_LINE_HEAVY : GRID_LINE_LIGHT,
      color: rgb(0.55, 0.55, 0.6),
    })
  }

  for (let line = 0; line < plan.columns; line++) {
    const absoluteX = plan.startX + line
    if ((absoluteX + 1) % 10 === 0) {
      page.drawText(String(absoluteX + 1), {
        x: originX + line * cellSize + cellSize / 2 - 4,
        y: originY + 4,
        size: GRID_LABEL_SIZE - 1,
        font,
      })
    }
  }
  for (let line = 0; line < plan.rows; line++) {
    const absoluteY = plan.startY + line
    if ((absoluteY + 1) % 10 === 0) {
      page.drawText(String(absoluteY + 1), {
        x: PAGE_MARGIN,
        y: originY - line * cellSize - cellSize / 2 - 3,
        size: GRID_LABEL_SIZE - 1,
        font,
      })
    }
  }

  if (cellSize >= 6) {
    const fontSize = Math.max(5, cellSize * 0.55)
    for (let row = 0; row < plan.rows; row++) {
      for (let column = 0; column < plan.columns; column++) {
        const absoluteX = plan.startX + column
        const absoluteY = plan.startY + row
        const symbol = symbols[absoluteY * patternWidth + absoluteX]
        if (symbol === undefined || symbol === '') {
          continue
        }
        page.drawText(symbol, {
          x: originX + column * cellSize + cellSize * 0.32,
          y: originY - row * cellSize - cellSize * 0.72,
          size: fontSize,
          font,
          color: rgb(0.15, 0.15, 0.2),
        })
      }
    }
  }
}

export interface PdfServiceService {
  readonly generatePatternPdf: (
    pattern: Pattern,
    title: string,
  ) => Effect.Effect<Uint8Array, PdfGenerationError>
}

export class PdfService extends Context.Service<
  PdfService,
  PdfServiceService
>()('PdfService') {
  static readonly layer: Layer.Layer<PdfService> = Layer.succeed(PdfService, {
    generatePatternPdf: (pattern, title) =>
      Effect.tryPromise({
        try: async () => {
          const doc = await PDFDocument.create()
          const [font, boldFont] = await Promise.all([
            doc.embedFont(StandardFonts.Helvetica),
            doc.embedFont(StandardFonts.HelveticaBold),
          ])
          const context: PdfContext = { doc, font, boldFont }

          drawSummaryPage(context, pattern, title)

          const symbols = gridSymbols(pattern)
          const cellSize = chooseCellSize(pattern)
          const layout = planGridLayout(pattern, cellSize)
          layout.plans.forEach((plan, index) => {
            drawGridPage(
              context,
              pattern,
              title,
              layout,
              plan,
              index + 2,
              layout.totalPages + 1,
              symbols,
            )
          })

          return await doc.save()
        },
        catch: error =>
          PdfGenerationError.make({
            reason: error instanceof Error ? error.message : String(error),
          }),
      }),
  })
}
