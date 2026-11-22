import { Equal, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  Colour,
  Conversion,
  ConversionParameters,
  ConverterWorkspace,
  CrafterDevice,
  EstimateBasis,
  FabricSuggestion,
  FinishedDimensions,
  Floss,
  FlossCatalogue,
  FlossUsage,
  KeyEntry,
  Palette,
  Pattern,
  PatternCell,
  RasterImage,
  StitchDimensions,
} from './model'

const black = Colour.make({ red: 0, green: 0, blue: 0 })

const floss310 = Floss.make({
  brand: 'DMC',
  number: '310',
  name: 'Black',
  colour: black,
})

const image = RasterImage.make({
  width: 100,
  height: 50,
  hasTransparency: false,
  format: 'PNG',
})

const parameters = ConversionParameters.make({
  targetSide: 'width',
  targetStitches: 50,
  colourCount: 4,
  dithering: true,
  paletteMode: 'supplied',
  maybePalette: Option.some(
    Palette.make({ source: 'supplied', entries: [floss310] }),
  ),
  fabricCount: 14,
})

describe('entity fields', () => {
  test('entity-fields.RasterImage: all declared fields present with correct types', () => {
    expect(image.width).toBe(100)
    expect(image.height).toBe(50)
    expect(image.hasTransparency).toBe(false)
    expect(image.format).toBe('PNG')
  })

  test('entity-fields.Colour: all declared fields present with correct types', () => {
    const colour = Colour.make({ red: 1, green: 2, blue: 3 })
    expect(colour.red).toBe(1)
    expect(colour.green).toBe(2)
    expect(colour.blue).toBe(3)
  })

  test('entity-fields.ConversionParameters: all declared fields present with correct types', () => {
    expect(parameters.targetSide).toBe('width')
    expect(parameters.targetStitches).toBe(50)
    expect(parameters.colourCount).toBe(4)
    expect(parameters.dithering).toBe(true)
    expect(parameters.paletteMode).toBe('supplied')
    expect(Option.isSome(parameters.maybePalette)).toBe(true)
    expect(parameters.fabricCount).toBe(14)
  })

  test('entity-fields.Palette: all declared fields present with correct types', () => {
    const palette = Palette.make({ source: 'derived', entries: [floss310] })
    expect(palette.source).toBe('derived')
    expect(palette.entries).toHaveLength(1)
  })

  test('entity-fields.StitchDimensions: all declared fields present with correct types', () => {
    const dimensions = StitchDimensions.make({ width: 50, height: 25 })
    expect(dimensions.width).toBe(50)
    expect(dimensions.height).toBe(25)
  })

  test('entity-fields.FinishedDimensions: all declared fields present with correct types', () => {
    const dimensions = FinishedDimensions.make({
      widthIn: 3.57,
      heightIn: 1.79,
      widthCm: 9.08,
      heightCm: 4.54,
    })
    expect(dimensions.widthIn).toBe(3.57)
    expect(dimensions.heightIn).toBe(1.79)
    expect(dimensions.widthCm).toBe(9.08)
    expect(dimensions.heightCm).toBe(4.54)
  })

  test('entity-fields.EstimateBasis: all declared fields present with correct types', () => {
    const basis = EstimateBasis.make({
      fabricCount: 14,
      strands: 2,
      skeinLengthM: 8,
    })
    expect(basis.fabricCount).toBe(14)
    expect(basis.strands).toBe(2)
    expect(basis.skeinLengthM).toBe(8)
  })

  test('entity-fields.FabricSuggestion: all declared fields present with correct types', () => {
    const suggestion = FabricSuggestion.make({
      count: 14,
      cutWidthCm: 20,
      cutHeightCm: 12,
    })
    expect(suggestion.count).toBe(14)
    expect(suggestion.cutWidthCm).toBe(20)
    expect(suggestion.cutHeightCm).toBe(12)
  })

  test('entity-fields.PatternCell: all declared fields present with correct types', () => {
    const cell = PatternCell.make({ x: 1, y: 1, symbol: 'A', floss: floss310 })
    expect(cell.x).toBe(1)
    expect(cell.y).toBe(1)
    expect(cell.symbol).toBe('A')
    expect(cell.floss.number).toBe('310')
  })

  test('entity-fields.KeyEntry: all declared fields present with correct types', () => {
    const entry = KeyEntry.make({ symbol: 'A', floss: floss310 })
    expect(entry.symbol).toBe('A')
    expect(entry.floss.number).toBe('310')
  })

  test('entity-fields.FlossUsage: all declared fields present with correct types', () => {
    const usage = FlossUsage.make({
      floss: floss310,
      stitchCount: 1200,
      skeins: 1,
    })
    expect(usage.floss.number).toBe('310')
    expect(usage.stitchCount).toBe(1200)
    expect(usage.skeins).toBe(1)
  })

  test('entity-fields.CrafterDevice: all declared fields present with correct types', () => {
    const device = CrafterDevice.make({ sessionStartedAt: new Date(0) })
    expect(device.sessionStartedAt).toEqual(new Date(0))
  })

  test('entity-fields.ConverterWorkspace: all declared fields present with correct types', () => {
    const workspace = ConverterWorkspace.make({
      maybeCurrent: Option.none(),
    })
    expect(Option.isNone(workspace.maybeCurrent)).toBe(true)
  })

  test('entity-fields.FlossCatalogue: all declared fields present with correct types', () => {
    const catalogue = FlossCatalogue.make({ entries: [floss310] })
    expect(catalogue.entries).toHaveLength(1)
  })

  test('entity-fields.Floss: all declared fields present with correct types', () => {
    expect(floss310.brand).toBe('DMC')
    expect(floss310.number).toBe('310')
    expect(floss310.name).toBe('Black')
    expect(floss310.colour).toEqual(black)
  })

  test('entity-fields.Conversion: all declared fields present with correct types', () => {
    const conversion = Conversion.make({
      status: 'completed',
      parameters,
      maybeRejectionReason: Option.none(),
      source: image,
      createdAt: new Date(0),
      maybePattern: Option.none(),
    })
    expect(conversion.status).toBe('completed')
    expect(conversion.source).toEqual(image)
  })

  test('entity-fields.Pattern: all declared fields present with correct types', () => {
    const pattern = Pattern.make({
      stitchDimensions: StitchDimensions.make({ width: 2, height: 2 }),
      finishedDimensions: FinishedDimensions.make({
        widthIn: 0.14,
        heightIn: 0.14,
        widthCm: 0.36,
        heightCm: 0.36,
      }),
      estimateBasis: EstimateBasis.make({
        fabricCount: 14,
        strands: 2,
        skeinLengthM: 8,
      }),
      suggestedFabric: FabricSuggestion.make({
        count: 14,
        cutWidthCm: 20,
        cutHeightCm: 20,
      }),
      preview: image,
      cells: [
        PatternCell.make({ x: 1, y: 1, symbol: 'A', floss: floss310 }),
        PatternCell.make({ x: 2, y: 1, symbol: 'B', floss: floss310 }),
        PatternCell.make({ x: 1, y: 2, symbol: 'A', floss: floss310 }),
        PatternCell.make({ x: 2, y: 2, symbol: 'B', floss: floss310 }),
      ],
      key: [
        KeyEntry.make({ symbol: 'A', floss: floss310 }),
        KeyEntry.make({ symbol: 'B', floss: floss310 }),
      ],
      usage: [FlossUsage.make({ floss: floss310, stitchCount: 4, skeins: 1 })],
    })
    expect(pattern.cells).toHaveLength(4)
    expect(pattern.key).toHaveLength(2)
    expect(pattern.usage).toHaveLength(1)
    expect(pattern.preview.format).toBe('PNG')
  })
})

describe('value equality', () => {
  test('value-equality.Colour: structurally equal values compare equal', () => {
    expect(
      Equal.equals(
        Colour.make({ red: 1, green: 2, blue: 3 }),
        Colour.make({ red: 1, green: 2, blue: 3 }),
      ),
    ).toBe(true)
    expect(
      Equal.equals(
        Colour.make({ red: 1, green: 2, blue: 3 }),
        Colour.make({ red: 1, green: 2, blue: 4 }),
      ),
    ).toBe(false)
  })

  test('value-equality.ConversionParameters: structurally equal values compare equal', () => {
    const other = ConversionParameters.make({ ...parameters })
    expect(Equal.equals(parameters, other)).toBe(true)
    expect(
      Equal.equals(
        parameters,
        ConversionParameters.make({ ...parameters, targetStitches: 60 }),
      ),
    ).toBe(false)
  })

  test('value-equality.Palette: structurally equal values compare equal', () => {
    const palette = Palette.make({ source: 'supplied', entries: [floss310] })
    expect(
      Equal.equals(
        palette,
        Palette.make({ source: 'supplied', entries: [floss310] }),
      ),
    ).toBe(true)
    expect(
      Equal.equals(
        palette,
        Palette.make({ source: 'derived', entries: [floss310] }),
      ),
    ).toBe(false)
  })

  test('value-equality.StitchDimensions: structurally equal values compare equal', () => {
    expect(
      Equal.equals(
        StitchDimensions.make({ width: 50, height: 25 }),
        StitchDimensions.make({ width: 50, height: 25 }),
      ),
    ).toBe(true)
  })

  test('value-equality.FinishedDimensions: structurally equal values compare equal', () => {
    expect(
      Equal.equals(
        FinishedDimensions.make({
          widthIn: 3.57,
          heightIn: 1.79,
          widthCm: 9.08,
          heightCm: 4.54,
        }),
        FinishedDimensions.make({
          widthIn: 3.57,
          heightIn: 1.79,
          widthCm: 9.08,
          heightCm: 4.54,
        }),
      ),
    ).toBe(true)
  })

  test('value-equality.EstimateBasis: structurally equal values compare equal', () => {
    expect(
      Equal.equals(
        EstimateBasis.make({ fabricCount: 14, strands: 2, skeinLengthM: 8 }),
        EstimateBasis.make({ fabricCount: 14, strands: 2, skeinLengthM: 8 }),
      ),
    ).toBe(true)
  })

  test('value-equality.FabricSuggestion: structurally equal values compare equal', () => {
    expect(
      Equal.equals(
        FabricSuggestion.make({ count: 14, cutWidthCm: 20, cutHeightCm: 12 }),
        FabricSuggestion.make({ count: 14, cutWidthCm: 20, cutHeightCm: 12 }),
      ),
    ).toBe(true)
  })

  test('value-equality.PatternCell: structurally equal values compare equal', () => {
    expect(
      Equal.equals(
        PatternCell.make({ x: 1, y: 1, symbol: 'A', floss: floss310 }),
        PatternCell.make({ x: 1, y: 1, symbol: 'A', floss: floss310 }),
      ),
    ).toBe(true)
  })

  test('value-equality.KeyEntry: structurally equal values compare equal', () => {
    expect(
      Equal.equals(
        KeyEntry.make({ symbol: 'A', floss: floss310 }),
        KeyEntry.make({ symbol: 'A', floss: floss310 }),
      ),
    ).toBe(true)
  })

  test('value-equality.FlossUsage: structurally equal values compare equal', () => {
    expect(
      Equal.equals(
        FlossUsage.make({ floss: floss310, stitchCount: 10, skeins: 1 }),
        FlossUsage.make({ floss: floss310, stitchCount: 10, skeins: 1 }),
      ),
    ).toBe(true)
  })
})

describe('enum comparability', () => {
  test('enum-comparable.PaletteMode: values are distinct and comparable', () => {
    const derived = ConversionParameters.make({
      ...parameters,
      paletteMode: 'derived',
    })
    const supplied = ConversionParameters.make({
      ...parameters,
      paletteMode: 'supplied',
    })
    expect(derived.paletteMode).not.toBe(supplied.paletteMode)
    expect(derived.paletteMode === 'derived').toBe(true)
  })

  test('enum-comparable.TargetSide: values are distinct and comparable', () => {
    const byWidth = ConversionParameters.make({
      ...parameters,
      targetSide: 'width',
    })
    const byHeight = ConversionParameters.make({
      ...parameters,
      targetSide: 'height',
    })
    expect(byWidth.targetSide).not.toBe(byHeight.targetSide)
  })

  test('enum-comparable.ConversionStatus: values are distinct and comparable', () => {
    const completed = Conversion.make({
      status: 'completed',
      parameters,
      maybeRejectionReason: Option.none(),
      source: image,
      createdAt: new Date(0),
      maybePattern: Option.none(),
    })
    const rejected = Conversion.make({
      ...completed,
      status: 'rejected',
      maybeRejectionReason: Option.some('exceeds product limits'),
    })
    expect(completed.status).not.toBe(rejected.status)
    expect(completed.status === 'completed').toBe(true)
  })
})

describe('optional fields', () => {
  test('entity-optional.ConverterWorkspace.current: accepts absent and present values', () => {
    const empty = ConverterWorkspace.make({ maybeCurrent: Option.none() })
    const conversion = Conversion.make({
      status: 'completed',
      parameters,
      maybeRejectionReason: Option.none(),
      source: image,
      createdAt: new Date(0),
      maybePattern: Option.none(),
    })
    const occupied = ConverterWorkspace.make({
      maybeCurrent: Option.some(conversion),
    })
    expect(Option.isNone(empty.maybeCurrent)).toBe(true)
    expect(Option.isSome(occupied.maybeCurrent)).toBe(true)
  })

  test('entity-optional.Conversion.rejection_reason: accepts absent and present values', () => {
    const withoutReason = Conversion.make({
      status: 'completed',
      parameters,
      maybeRejectionReason: Option.none(),
      source: image,
      createdAt: new Date(0),
      maybePattern: Option.none(),
    })
    const withReason = Conversion.make({
      ...withoutReason,
      status: 'rejected',
      maybeRejectionReason: Option.some('exceeds product limits'),
    })
    expect(Option.isNone(withoutReason.maybeRejectionReason)).toBe(true)
    expect(Option.getOrNull(withReason.maybeRejectionReason)).toBe(
      'exceeds product limits',
    )
  })
})

describe('relationships', () => {
  test('entity-relationship.FlossCatalogue.entries: navigates to the catalogue flosses', () => {
    const catalogue = FlossCatalogue.make({
      entries: [
        floss310,
        Floss.make({
          brand: 'Anchor',
          number: '403',
          name: 'Strawberry',
          colour: Colour.make({ red: 200, green: 0, blue: 0 }),
        }),
      ],
    })
    expect(catalogue.entries).toHaveLength(2)
    expect(catalogue.entries[0]?.brand).toBe('DMC')
    expect(catalogue.entries[1]?.brand).toBe('Anchor')
  })

  test('entity-relationship.Conversion.pattern: navigates to the conversion pattern', () => {
    const pattern = Pattern.make({
      stitchDimensions: StitchDimensions.make({ width: 1, height: 1 }),
      finishedDimensions: FinishedDimensions.make({
        widthIn: 0.07,
        heightIn: 0.07,
        widthCm: 0.18,
        heightCm: 0.18,
      }),
      estimateBasis: EstimateBasis.make({
        fabricCount: 14,
        strands: 2,
        skeinLengthM: 8,
      }),
      suggestedFabric: FabricSuggestion.make({
        count: 14,
        cutWidthCm: 20,
        cutHeightCm: 20,
      }),
      preview: image,
      cells: [PatternCell.make({ x: 1, y: 1, symbol: 'A', floss: floss310 })],
      key: [KeyEntry.make({ symbol: 'A', floss: floss310 })],
      usage: [FlossUsage.make({ floss: floss310, stitchCount: 1, skeins: 1 })],
    })
    const conversion = Conversion.make({
      status: 'completed',
      parameters,
      maybeRejectionReason: Option.none(),
      source: image,
      createdAt: new Date(0),
      maybePattern: Option.some(pattern),
    })
    expect(Option.getOrNull(conversion.maybePattern)).toEqual(pattern)
  })
})
