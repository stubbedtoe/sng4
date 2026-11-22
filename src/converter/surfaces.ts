import { Option } from 'effect'

import type {
  ConversionStatus,
  CrafterDevice,
  FinishedDimensions,
  FlossCatalogue,
  Pattern,
  RasterImage,
  StitchDimensions,
} from './model'

const catalogueContains = (
  catalogue: FlossCatalogue,
  brand: string,
  number: string,
): boolean =>
  catalogue.entries.some(
    entry => entry.brand === brand && entry.number === number,
  )

export interface ConverterView {
  readonly status: Option.Option<ConversionStatus>
  readonly maybeStitchDimensions: Option.Option<StitchDimensions>
  readonly maybeFinishedDimensions: Option.Option<FinishedDimensions>
  readonly maybeTotalStitches: Option.Option<number>
  readonly maybePaletteColours: Option.Option<number>
  readonly maybePreview: Option.Option<RasterImage>
}

export const converterView = (
  _device: CrafterDevice,
  workspace: {
    readonly maybeCurrent: Option.Option<{
      readonly status: ConversionStatus
      readonly maybePattern: Option.Option<Pattern>
    }>
  },
): ConverterView => {
  const empty: ConverterView = {
    status: Option.none(),
    maybeStitchDimensions: Option.none(),
    maybeFinishedDimensions: Option.none(),
    maybeTotalStitches: Option.none(),
    maybePaletteColours: Option.none(),
    maybePreview: Option.none(),
  }

  return Option.match(workspace.maybeCurrent, {
    onNone: () => empty,
    onSome: current =>
      Option.match(current.maybePattern, {
        onNone: () => ({ ...empty, status: Option.some(current.status) }),
        onSome: pattern => ({
          status: Option.some(current.status),
          maybeStitchDimensions: Option.some(pattern.stitchDimensions),
          maybeFinishedDimensions: Option.some(pattern.finishedDimensions),
          maybeTotalStitches: Option.some(pattern.cells.length),
          maybePaletteColours: Option.some(pattern.palette.entries.length),
          maybePreview: Option.some(pattern.preview),
        }),
      }),
  })
}

export const canExportPatternPdf = (
  _device: CrafterDevice,
  workspace: {
    readonly maybeCurrent: Option.Option<{ readonly status: ConversionStatus }>
  },
): boolean =>
  Option.exists(
    workspace.maybeCurrent,
    current => current.status === 'completed',
  )

export interface PatternView {
  readonly stitchDimensions: StitchDimensions
  readonly finishedDimensions: FinishedDimensions
  readonly estimateBasis: Pattern['estimateBasis']
  readonly suggestedFabric: Pattern['suggestedFabric']
  readonly totalStitches: number
  readonly cells: ReadonlyArray<{
    readonly x: number
    readonly y: number
    readonly symbol: string
    readonly floss: Pattern['cells'][number]['floss']
  }>
  readonly key: Pattern['key']
  readonly usage: Pattern['usage']
}

export const patternView = (
  _device: CrafterDevice,
  pattern: Pattern,
): PatternView => ({
  stitchDimensions: pattern.stitchDimensions,
  finishedDimensions: pattern.finishedDimensions,
  estimateBasis: pattern.estimateBasis,
  suggestedFabric: pattern.suggestedFabric,
  totalStitches: pattern.cells.length,
  cells: pattern.cells,
  key: pattern.key,
  usage: pattern.usage,
})

export interface StitchLookup {
  readonly symbol: string
  readonly flossNumber: string
  readonly flossName: string
}

export const canLookUpStitch = (
  _device: CrafterDevice,
  pattern: Pattern,
  x: number,
  y: number,
): boolean =>
  x >= 1 &&
  x <= pattern.stitchDimensions.width &&
  y >= 1 &&
  y <= pattern.stitchDimensions.height

export const lookUpStitch = (
  device: CrafterDevice,
  pattern: Pattern,
  x: number,
  y: number,
): Option.Option<StitchLookup> => {
  if (!canLookUpStitch(device, pattern, x, y)) {
    return Option.none()
  }
  const cell = pattern.cells[(y - 1) * pattern.stitchDimensions.width + (x - 1)]
  if (cell === undefined) {
    return Option.none()
  }
  return Option.some({
    symbol: cell.symbol,
    flossNumber: cell.floss.number,
    flossName: cell.floss.name,
  })
}

export const catalogueView = (
  _device: CrafterDevice,
  catalogue: FlossCatalogue,
): FlossCatalogue['entries'] => catalogue.entries

export const canAddFloss = (
  _device: CrafterDevice,
  catalogue: FlossCatalogue,
  brand: string,
  number: string,
): boolean => !catalogueContains(catalogue, brand, number)
