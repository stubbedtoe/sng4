import { Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { CONVERTER_CONFIG } from './config'
import { convertImage } from './convert'
import {
  Colour,
  ConversionParameters,
  ConverterWorkspace,
  Floss,
  FlossCatalogue,
  type Pattern,
  RasterImage,
} from './model'
import {
  canAddFloss,
  canExportPatternPdf,
  canLookUpStitch,
  catalogueView,
  converterView,
  lookUpStitch,
  patternView,
} from './surfaces'

const flosses = ['310', '666', '321', '720'].map(number =>
  Floss.make({
    brand: 'DMC',
    number,
    name: `Floss ${number}`,
    colour: Colour.make({ red: 100, green: 50, blue: 25 }),
  }),
)

const catalogue = FlossCatalogue.make({ entries: flosses })

const epoch = new Date(0)

const device = { sessionStartedAt: epoch }

const converted = (): {
  workspace: typeof ConverterWorkspace.Type
  pattern: Pattern
} => {
  const { workspace, conversion } = Result.getOrThrow(
    convertImage({
      image: RasterImage.make({
        width: 100,
        height: 50,
        hasTransparency: false,
        format: 'PNG',
      }),
      parameters: ConversionParameters.make({
        targetSide: 'width',
        targetStitches: 50,
        colourCount: 4,
        dithering: true,
        paletteMode: 'derived',
        maybePalette: Option.none(),
        fabricCount: CONVERTER_CONFIG.default_fabric_count,
      }),
      catalogue,
      workspace: ConverterWorkspace.make({ maybeCurrent: Option.none() }),
      now: epoch,
    }),
  )
  return { workspace, pattern: Option.getOrThrow(conversion.maybePattern) }
}

const emptyWorkspace = ConverterWorkspace.make({ maybeCurrent: Option.none() })

describe('surface Converter', () => {
  test('surface-actor.Converter: any crafter device can view the converter', () => {
    const view = converterView(device, emptyWorkspace)
    expect(Option.isNone(view.status)).toBe(true)
  })

  test('surface-exposure.Converter: empty workspace exposes nothing', () => {
    const view = converterView(device, emptyWorkspace)
    expect(Option.isNone(view.status)).toBe(true)
    expect(Option.isNone(view.maybeStitchDimensions)).toBe(true)
    expect(Option.isNone(view.maybeFinishedDimensions)).toBe(true)
    expect(Option.isNone(view.maybeTotalStitches)).toBe(true)
    expect(Option.isNone(view.maybePaletteColours)).toBe(true)
    expect(Option.isNone(view.maybePreview)).toBe(true)
  })

  test('surface-exposure.Converter: completed conversion exposes status, dimensions, totals, preview', () => {
    const { workspace, pattern } = converted()
    const view = converterView(device, workspace)
    expect(Option.getOrNull(view.status)).toBe('completed')
    expect(Option.getOrNull(view.maybeStitchDimensions)).toEqual(
      pattern.stitchDimensions,
    )
    expect(Option.getOrNull(view.maybeFinishedDimensions)).toEqual(
      pattern.finishedDimensions,
    )
    expect(Option.getOrNull(view.maybeTotalStitches)).toBe(1250)
    expect(Option.getOrNull(view.maybePaletteColours)).toBe(4)
    expect(Option.getOrNull(view.maybePreview)).toEqual(pattern.preview)
  })

  test('surface-provides.Converter: export is hidden until a conversion completes', () => {
    expect(canExportPatternPdf(device, emptyWorkspace)).toBe(false)
    const { workspace } = converted()
    expect(canExportPatternPdf(device, workspace)).toBe(true)
  })

  test('surface-provides.Converter: a rejected re-run keeps export available', () => {
    const { workspace } = converted()
    const afterRejection = Result.getOrThrow(
      convertImage({
        image: RasterImage.make({
          width: 100,
          height: 50,
          hasTransparency: false,
          format: 'PNG',
        }),
        parameters: ConversionParameters.make({
          targetSide: 'width',
          targetStitches: 0,
          colourCount: 4,
          dithering: true,
          paletteMode: 'derived',
          maybePalette: Option.none(),
          fabricCount: 14,
        }),
        catalogue,
        workspace,
        now: epoch,
      }),
    )
    expect(afterRejection.conversion.status).toBe('rejected')
    expect(canExportPatternPdf(device, afterRejection.workspace)).toBe(true)
  })
})

describe('surface PatternViewer', () => {
  test('surface-actor.PatternViewer: any crafter device can view a pattern', () => {
    const { pattern } = converted()
    expect(patternView(device, pattern).totalStitches).toBe(1250)
  })

  test('surface-exposure.PatternViewer: grid, key, usage, dimensions, fabric all accessible', () => {
    const { pattern } = converted()
    const view = patternView(device, pattern)
    expect(view.stitchDimensions).toEqual({ width: 50, height: 25 })
    expect(view.finishedDimensions).toEqual(pattern.finishedDimensions)
    expect(view.estimateBasis).toEqual(pattern.estimateBasis)
    expect(view.suggestedFabric).toEqual(pattern.suggestedFabric)
    expect(view.totalStitches).toBe(pattern.cells.length)
    expect(view.cells).toHaveLength(1250)
    expect(view.cells[0]?.x).toBe(1)
    expect(view.cells[0]?.y).toBe(1)
    expect(typeof view.cells[0]?.symbol).toBe('string')
    expect(view.key).toHaveLength(4)
    expect(typeof view.key[0]?.symbol).toBe('string')
    expect(typeof view.key[0]?.floss.number).toBe('string')
    expect(typeof view.key[0]?.floss.name).toBe('string')
    expect(view.usage.reduce((sum, u) => sum + u.stitchCount, 0)).toBe(1250)
    expect(typeof view.usage[0]?.skeins).toBe('number')
  })

  test('surface-provides.PatternViewer: stitch lookup is available only inside the grid', () => {
    const { pattern } = converted()
    expect(canLookUpStitch(device, pattern, 1, 1)).toBe(true)
    expect(canLookUpStitch(device, pattern, 50, 25)).toBe(true)
    expect(canLookUpStitch(device, pattern, 0, 1)).toBe(false)
    expect(canLookUpStitch(device, pattern, 1, 0)).toBe(false)
    expect(canLookUpStitch(device, pattern, 51, 1)).toBe(false)
    expect(canLookUpStitch(device, pattern, 1, 26)).toBe(false)
  })

  test('guarantee StitchLookupResult: lookup returns symbol, floss number, and floss name', () => {
    const { pattern } = converted()
    const lookup = Option.getOrThrow(lookUpStitch(device, pattern, 1, 1))
    const firstCell = pattern.cells[0]
    const keyEntry = pattern.key.find(
      entry => entry.symbol === firstCell?.symbol,
    )
    expect(lookup.symbol).toBe(firstCell?.symbol)
    expect(lookup.flossNumber).toBe(keyEntry?.floss.number)
    expect(lookup.flossName).toBe(keyEntry?.floss.name)
    expect(Option.isNone(lookUpStitch(device, pattern, 0, 0))).toBe(true)
  })
})

describe('surface FlossCatalogueAdmin', () => {
  test('surface-actor.FlossCatalogueAdmin: any crafter device can browse the catalogue', () => {
    const view = catalogueView(device, catalogue)
    expect(view).toHaveLength(4)
  })

  test('surface-exposure.FlossCatalogueAdmin: entries expose brand, number, name, colour', () => {
    const [first] = catalogueView(device, catalogue)
    expect(first?.brand).toBe('DMC')
    expect(first?.number).toBe('310')
    expect(first?.name).toBe('Floss 310')
    expect(first?.colour.red).toBe(100)
  })

  test('surface-provides.FlossCatalogueAdmin: adding is hidden for a duplicate brand+number', () => {
    expect(canAddFloss(device, catalogue, 'DMC', '310')).toBe(false)
    expect(canAddFloss(device, catalogue, 'Anchor', '310')).toBe(true)
  })
})
