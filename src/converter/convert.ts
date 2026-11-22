import { Option, Result } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import {
  type IndexedImage,
  convertToIndexed,
  ditherToIndexed,
  preparePalette,
} from '../transforms/indexed'
import { buildPattern } from '../transforms/pattern'
import {
  compositeOverBackground,
  resizePixelsNearest,
} from '../transforms/resize'
import { CONVERTER_CONFIG } from './config'
import { fitDimensions } from './dimensions'
import {
  type Conversion,
  type ConversionParameters,
  type ConverterWorkspace,
  type FlossCatalogue,
  type Palette,
  type RasterImage,
} from './model'

export const ConvertImageError = defineTaggedUnion({
  MissingSuppliedPalette: {},
})
export type ConvertImageError = typeof ConvertImageError.Type

export interface ConvertImageInput {
  readonly image: RasterImage
  readonly parameters: ConversionParameters
  readonly catalogue: FlossCatalogue
  readonly workspace: ConverterWorkspace
  readonly now: Date
}

export interface ConvertImageResult {
  readonly workspace: ConverterWorkspace
  readonly conversion: Conversion
}

export const resolvePalette = (
  parameters: ConversionParameters,
  catalogue: FlossCatalogue,
): Palette =>
  Option.match(parameters.maybePalette, {
    onNone: () => ({
      source: 'derived' as const,
      entries: catalogue.entries.slice(0, parameters.colourCount),
    }),
    onSome: palette => palette,
  })

const rejectionReason = 'exceeds product limits or unsupported image format'

export const exceedsLimits = (
  image: Readonly<{ width: number; height: number; format: string }>,
  targetSide: ConversionParameters['targetSide'],
  targetStitches: number,
  requestedColours: number,
): boolean => {
  const dimensions = fitDimensions(image, targetSide, targetStitches)
  return (
    targetStitches < 1 ||
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > CONVERTER_CONFIG.max_pattern_side ||
    dimensions.height > CONVERTER_CONFIG.max_pattern_side ||
    image.width > CONVERTER_CONFIG.max_source_side ||
    image.height > CONVERTER_CONFIG.max_source_side ||
    !CONVERTER_CONFIG.accepted_image_formats.includes(image.format) ||
    requestedColours < CONVERTER_CONFIG.min_colours ||
    requestedColours > CONVERTER_CONFIG.max_colours
  )
}

const synthesizeIndexed = (width: number, height: number): IndexedImage => ({
  width,
  height,
  indices: new Uint8Array(width * height),
})

export const convertImage = (
  input: ConvertImageInput,
): Result.Result<ConvertImageResult, ConvertImageError> => {
  const { image, parameters, catalogue, workspace, now } = input

  if (
    parameters.paletteMode === 'supplied' &&
    Option.isNone(parameters.maybePalette)
  ) {
    return Result.fail(ConvertImageError.MissingSuppliedPalette())
  }

  const palette = resolvePalette(parameters, catalogue)
  const dimensions = fitDimensions(
    image,
    parameters.targetSide,
    parameters.targetStitches,
  )

  if (
    exceedsLimits(
      image,
      parameters.targetSide,
      parameters.targetStitches,
      parameters.paletteMode === 'derived'
        ? parameters.colourCount
        : palette.entries.length,
    )
  ) {
    return Result.succeed({
      workspace,
      conversion: {
        status: 'rejected',
        parameters,
        maybeRejectionReason: Option.some(rejectionReason),
        source: image,
        createdAt: now,
        maybePattern: Option.none(),
      },
    })
  }

  const indexed = Option.match(image.maybePixels, {
    onNone: () => synthesizeIndexed(dimensions.width, dimensions.height),
    onSome: pixels => {
      const composited = compositeOverBackground(
        pixels,
        CONVERTER_CONFIG.default_background,
      )
      const resized = resizePixelsNearest(
        composited,
        dimensions.width,
        dimensions.height,
      )
      const prepared = preparePalette(
        palette.entries.map(entry => entry.colour),
      )
      return parameters.dithering
        ? ditherToIndexed(resized, prepared)
        : convertToIndexed(resized, prepared)
    },
  })

  const pattern = buildPattern({
    indexed,
    palette,
    fabricCount: parameters.fabricCount,
  })

  const conversion: Conversion = {
    status: 'completed',
    parameters,
    maybeRejectionReason: Option.none(),
    source: image,
    createdAt: now,
    maybePattern: Option.some(pattern),
  }

  return Result.succeed({
    workspace: { maybeCurrent: Option.some(conversion) },
    conversion,
  })
}
