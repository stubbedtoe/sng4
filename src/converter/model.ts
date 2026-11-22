import { Effect, Option, Schema } from 'effect'

// VALUE TYPES

export const Colour = Schema.Struct({
  red: Schema.Int,
  green: Schema.Int,
  blue: Schema.Int,
})
export type Colour = typeof Colour.Type

export const ImagePixels = Schema.Struct({
  width: Schema.Int,
  height: Schema.Int,
  data: Schema.Uint8Array,
})
export type ImagePixels = typeof ImagePixels.Type

export const RasterImage = Schema.Struct({
  width: Schema.Int,
  height: Schema.Int,
  hasTransparency: Schema.Boolean,
  format: Schema.String,
  maybePixels: Schema.Option(ImagePixels).pipe(
    Schema.withConstructorDefault(Effect.succeed(Option.none())),
  ),
})
export type RasterImage = typeof RasterImage.Type

export const TargetSide = Schema.Literals(['width', 'height'])
export type TargetSide = typeof TargetSide.Type

export const PaletteMode = Schema.Literals(['derived', 'supplied'])
export type PaletteMode = typeof PaletteMode.Type

export const Floss = Schema.Struct({
  brand: Schema.String,
  number: Schema.String,
  name: Schema.String,
  colour: Colour,
})
export type Floss = typeof Floss.Type

export type FlossInput = Readonly<{
  brand: string
  number: string
  name: string
  colour: Colour
}>

export const Palette = Schema.Struct({
  source: PaletteMode,
  entries: Schema.Array(Floss),
})
export type Palette = typeof Palette.Type

export const StitchDimensions = Schema.Struct({
  width: Schema.Int,
  height: Schema.Int,
})
export type StitchDimensions = typeof StitchDimensions.Type

export const FinishedDimensions = Schema.Struct({
  widthIn: Schema.Number,
  heightIn: Schema.Number,
  widthCm: Schema.Number,
  heightCm: Schema.Number,
})
export type FinishedDimensions = typeof FinishedDimensions.Type

export const EstimateBasis = Schema.Struct({
  fabricCount: Schema.Int,
  strands: Schema.Int,
  skeinLengthM: Schema.Number,
})
export type EstimateBasis = typeof EstimateBasis.Type

export const FabricSuggestion = Schema.Struct({
  count: Schema.Int,
  cutWidthCm: Schema.Number,
  cutHeightCm: Schema.Number,
})
export type FabricSuggestion = typeof FabricSuggestion.Type

export const PatternCell = Schema.Struct({
  x: Schema.Int,
  y: Schema.Int,
  symbol: Schema.String,
  floss: Floss,
})
export type PatternCell = typeof PatternCell.Type

export const KeyEntry = Schema.Struct({
  symbol: Schema.String,
  floss: Floss,
})
export type KeyEntry = typeof KeyEntry.Type

export const FlossUsage = Schema.Struct({
  floss: Floss,
  stitchCount: Schema.Int,
  skeins: Schema.Int,
})
export type FlossUsage = typeof FlossUsage.Type

// ENTITIES

export const FlossCatalogue = Schema.Struct({
  entries: Schema.Array(Floss),
})
export type FlossCatalogue = typeof FlossCatalogue.Type

export const Pattern = Schema.Struct({
  stitchDimensions: StitchDimensions,
  finishedDimensions: FinishedDimensions,
  estimateBasis: EstimateBasis,
  suggestedFabric: FabricSuggestion,
  preview: RasterImage,
  cells: Schema.Array(PatternCell),
  key: Schema.Array(KeyEntry),
  usage: Schema.Array(FlossUsage),
  palette: Palette.pipe(
    Schema.withConstructorDefault(
      Effect.succeed(Palette.make({ source: 'derived', entries: [] })),
    ),
  ),
})
export type Pattern = typeof Pattern.Type

export const ConversionStatus = Schema.Literals(['completed', 'rejected'])
export type ConversionStatus = typeof ConversionStatus.Type

export const Conversion = Schema.Struct({
  status: ConversionStatus,
  parameters: Schema.Struct({
    targetSide: TargetSide,
    targetStitches: Schema.Int,
    colourCount: Schema.Int,
    dithering: Schema.Boolean,
    paletteMode: PaletteMode,
    maybePalette: Schema.Option(Palette),
    fabricCount: Schema.Int,
  }),
  maybeRejectionReason: Schema.Option(Schema.String),
  source: RasterImage,
  createdAt: Schema.Date,
  maybePattern: Schema.Option(Pattern),
})
export type Conversion = typeof Conversion.Type

export const ConversionParameters = Conversion.fields.parameters
export type ConversionParameters = typeof ConversionParameters.Type

export const CrafterDevice = Schema.Struct({
  sessionStartedAt: Schema.Date,
})
export type CrafterDevice = typeof CrafterDevice.Type

export const ConverterWorkspace = Schema.Struct({
  maybeCurrent: Schema.Option(Conversion),
})
export type ConverterWorkspace = typeof ConverterWorkspace.Type
