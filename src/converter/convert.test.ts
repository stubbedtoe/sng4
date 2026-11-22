import { Equal, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { CONVERTER_CONFIG } from './config'
import { convertImage } from './convert'
import {
  Colour,
  ConversionParameters,
  ConverterWorkspace,
  Floss,
  FlossCatalogue,
  RasterImage,
} from './model'

const flosses = ['310', '666', '321', '720', '825', '3819', '580', '703'].map(
  number =>
    Floss.make({
      brand: 'DMC',
      number,
      name: `Floss ${number}`,
      colour: Colour.make({ red: 100, green: 50, blue: 25 }),
    }),
)

const catalogue = FlossCatalogue.make({ entries: flosses })

const image = (
  overrides: Partial<typeof RasterImage.Type> = {},
): typeof RasterImage.Type =>
  RasterImage.make({
    width: 100,
    height: 50,
    hasTransparency: false,
    format: 'PNG',
    ...overrides,
  })

const parameters = (
  overrides: Partial<typeof ConversionParameters.Type> = {},
): typeof ConversionParameters.Type =>
  ConversionParameters.make({
    targetSide: 'width',
    targetStitches: 50,
    colourCount: 8,
    dithering: true,
    paletteMode: 'derived',
    maybePalette: Option.none(),
    fabricCount: CONVERTER_CONFIG.default_fabric_count,
    ...overrides,
  })

const emptyWorkspace = (): typeof ConverterWorkspace.Type =>
  ConverterWorkspace.make({ maybeCurrent: Option.none() })

const epoch = new Date(0)

describe('ConvertImage success', () => {
  test('rule-success.ConvertImage: a valid request completes with a full pattern', () => {
    const result = convertImage({
      image: image(),
      parameters: parameters(),
      catalogue,
      workspace: emptyWorkspace(),
      now: epoch,
    })
    expect(Result.isSuccess(result)).toBe(true)
    const { workspace, conversion } = Result.getOrThrow(result)
    expect(conversion.status).toBe('completed')
    expect(conversion.createdAt).toEqual(epoch)
    expect(Option.isSome(workspace.maybeCurrent)).toBe(true)
  })

  test('rule-success.ConvertImage: pattern carries grid, key, usage, dimensions, preview', () => {
    const { conversion } = Result.getOrThrow(
      convertImage({
        image: image(),
        parameters: parameters(),
        catalogue,
        workspace: emptyWorkspace(),
        now: epoch,
      }),
    )
    const pattern = Option.getOrThrow(conversion.maybePattern)
    expect(pattern.stitchDimensions).toEqual({ width: 50, height: 25 })
    expect(pattern.cells).toHaveLength(1250)
    expect(pattern.key).toHaveLength(8)
    expect(pattern.palette.source).toBe('derived')
    expect(pattern.palette.entries).toHaveLength(8)
    expect(pattern.preview.width).toBe(50)
    expect(pattern.preview.height).toBe(25)
  })

  test('rule-success.ConvertImage: finished dimensions derive from the fabric count', () => {
    const { conversion } = Result.getOrThrow(
      convertImage({
        image: image(),
        parameters: parameters(),
        catalogue,
        workspace: emptyWorkspace(),
        now: epoch,
      }),
    )
    const pattern = Option.getOrThrow(conversion.maybePattern)
    expect(pattern.finishedDimensions.widthIn).toBeCloseTo(50 / 14, 2)
    expect(pattern.finishedDimensions.heightIn).toBeCloseTo(25 / 14, 2)
    expect(pattern.finishedDimensions.widthCm).toBeCloseTo((50 / 14) * 2.54, 2)
    expect(pattern.finishedDimensions.heightCm).toBeCloseTo((25 / 14) * 2.54, 2)
    expect(pattern.estimateBasis).toEqual({
      fabricCount: 14,
      strands: 2,
      skeinLengthM: 8,
    })
  })

  test('rule-success.ConvertImage: suggested fabric is aida with margin around the design', () => {
    const { conversion } = Result.getOrThrow(
      convertImage({
        image: image(),
        parameters: parameters(),
        catalogue,
        workspace: emptyWorkspace(),
        now: epoch,
      }),
    )
    const pattern = Option.getOrThrow(conversion.maybePattern)
    expect(pattern.suggestedFabric.count).toBe(14)
    expect(pattern.suggestedFabric.cutWidthCm).toBeCloseTo(
      (50 / 14) * 2.54 + 2 * CONVERTER_CONFIG.fabric_margin_cm,
      1,
    )
  })

  test('rule-success.ConvertImage: a supplied palette is used as-is', () => {
    const suppliedPalette = {
      source: 'supplied' as const,
      entries: [flosses[0]!, flosses[1]!],
    }
    const { conversion } = Result.getOrThrow(
      convertImage({
        image: image(),
        parameters: parameters({
          paletteMode: 'supplied',
          maybePalette: Option.some(suppliedPalette),
          colourCount: 2,
        }),
        catalogue,
        workspace: emptyWorkspace(),
        now: epoch,
      }),
    )
    const pattern = Option.getOrThrow(conversion.maybePattern)
    expect(pattern.palette.source).toBe('supplied')
    expect(pattern.palette.entries).toHaveLength(2)
    expect(
      pattern.key.every(entry =>
        suppliedPalette.entries.some(floss => Equal.equals(floss, entry.floss)),
      ),
    ).toBe(true)
  })

  test('rule-failure.RejectConversion: a valid request is not rejected', () => {
    const { conversion } = Result.getOrThrow(
      convertImage({
        image: image(),
        parameters: parameters(),
        catalogue,
        workspace: emptyWorkspace(),
        now: epoch,
      }),
    )
    expect(conversion.status).toBe('completed')
    expect(Option.isNone(conversion.maybeRejectionReason)).toBe(true)
  })
})

describe('ConvertImage rejection', () => {
  const rejected = (
    overrides: Partial<typeof ConversionParameters.Type>,
    imageOverrides: Partial<typeof RasterImage.Type> = {},
  ) => {
    const result = convertImage({
      image: image(imageOverrides),
      parameters: parameters(overrides),
      catalogue,
      workspace: emptyWorkspace(),
      now: epoch,
    })
    expect(Result.isSuccess(result)).toBe(true)
    const { conversion, workspace } = Result.getOrThrow(result)
    expect(conversion.status).toBe('rejected')
    expect(Option.isSome(conversion.maybeRejectionReason)).toBe(true)
    expect(Option.isNone(workspace.maybeCurrent)).toBe(true)
  }

  test('rule-success.RejectConversion: target below one stitch is rejected', () => {
    rejected({ targetStitches: 0 })
  })

  test('rule-failure.ConvertImage.2: pattern side beyond the cap is rejected', () => {
    rejected({ targetStitches: CONVERTER_CONFIG.max_pattern_side + 1 })
  })

  test('rule-failure.ConvertImage.4: source side beyond the cap is rejected', () => {
    rejected({}, { width: CONVERTER_CONFIG.max_source_side + 1 })
  })

  test('rule-failure.ConvertImage.5: an unsupported image format is rejected', () => {
    rejected({}, { format: 'TIFF' })
  })

  test('rule-failure.ConvertImage.6: a colour count below the minimum is rejected', () => {
    rejected({ colourCount: 0 })
  })

  test('rule-failure.ConvertImage.7: a colour count above the maximum is rejected', () => {
    rejected({ colourCount: CONVERTER_CONFIG.max_colours + 1 })
  })
})

describe('ConvertImage caller contract', () => {
  test('rule-failure.ConvertImage.1: a supplied palette mode without a palette is a caller error', () => {
    const result = convertImage({
      image: image(),
      parameters: parameters({
        paletteMode: 'supplied',
        maybePalette: Option.none(),
      }),
      catalogue,
      workspace: emptyWorkspace(),
      now: epoch,
    })
    expect(Result.isFailure(result)).toBe(true)
  })
})

describe('invariants', () => {
  const convert = () =>
    Result.getOrThrow(
      convertImage({
        image: image(),
        parameters: parameters(),
        catalogue,
        workspace: emptyWorkspace(),
        now: epoch,
      }),
    )

  test('invariant.GridMatchesDimensions: one cell per stitch position', () => {
    const { conversion } = convert()
    const pattern = Option.getOrThrow(conversion.maybePattern)
    expect(pattern.cells).toHaveLength(
      pattern.stitchDimensions.width * pattern.stitchDimensions.height,
    )
  })

  test('invariant.UsageMatchesGrid: usage stitch counts sum to the grid size', () => {
    const { conversion } = convert()
    const pattern = Option.getOrThrow(conversion.maybePattern)
    const total = pattern.usage.reduce((sum, u) => sum + u.stitchCount, 0)
    expect(total).toBe(pattern.cells.length)
  })

  test('invariant.KeySymbolsUnique: each symbol identifies exactly one floss', () => {
    const { conversion } = convert()
    const pattern = Option.getOrThrow(conversion.maybePattern)
    const bySymbol = new Map(
      pattern.key.map(entry => [entry.symbol, entry.floss]),
    )
    expect(bySymbol.size).toBe(pattern.key.length)
  })

  test('invariant.EveryCellSymbolResolves: every cell symbol and floss appear in the key', () => {
    const { conversion } = convert()
    const pattern = Option.getOrThrow(conversion.maybePattern)
    expect(
      pattern.cells.every(cell =>
        pattern.key.some(
          entry => entry.symbol === cell.symbol && entry.floss === cell.floss,
        ),
      ),
    ).toBe(true)
  })
})

describe('re-run semantics', () => {
  test('a successful re-run replaces the previous pattern', () => {
    const first = Result.getOrThrow(
      convertImage({
        image: image(),
        parameters: parameters({ targetStitches: 50 }),
        catalogue,
        workspace: emptyWorkspace(),
        now: epoch,
      }),
    )
    const second = Result.getOrThrow(
      convertImage({
        image: image(),
        parameters: parameters({ targetStitches: 40 }),
        catalogue,
        workspace: first.workspace,
        now: epoch,
      }),
    )
    const current = Option.getOrThrow(second.workspace.maybeCurrent)
    const pattern = Option.getOrThrow(current.maybePattern)
    expect(pattern.stitchDimensions.width).toBe(40)
    expect(pattern.stitchDimensions.height).toBe(20)
    expect(Option.isSome(second.workspace.maybeCurrent)).toBe(true)
  })

  test('a rejected re-run leaves the last completed pattern in place', () => {
    const first = Result.getOrThrow(
      convertImage({
        image: image(),
        parameters: parameters(),
        catalogue,
        workspace: emptyWorkspace(),
        now: epoch,
      }),
    )
    const second = Result.getOrThrow(
      convertImage({
        image: image(),
        parameters: parameters({ targetStitches: 0 }),
        catalogue,
        workspace: first.workspace,
        now: epoch,
      }),
    )
    expect(second.conversion.status).toBe('rejected')
    expect(second.workspace).toEqual(first.workspace)
    const kept = Option.getOrThrow(second.workspace.maybeCurrent)
    expect(kept.status).toBe('completed')
    expect(Option.isSome(kept.maybePattern)).toBe(true)
  })
})
