import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import {
  Palette as PaletteSchema,
  RasterImage,
  TargetSide as TargetSideSchema,
} from '../converter/model'

export const DitherAlgorithm = Schema.Literals(['None', 'FloydSteinberg'])
export type DitherAlgorithm = typeof DitherAlgorithm.Type

export const Transformation = defineTaggedUnion({
  PaletteConversion: {},
  Dither: { algorithm: DitherAlgorithm },
  Pattern: {
    targetSide: TargetSideSchema,
    targetStitches: Schema.Int,
    fabricCount: Schema.Int,
  },
})
export type Transformation = typeof Transformation.Type

export const PaletteSpec = defineTaggedUnion({
  Extracted: { colourCount: Schema.Int },
  Custom: { palette: PaletteSchema },
})
export type PaletteSpec = typeof PaletteSpec.Type

export const Project = Schema.Struct({
  sourceId: Schema.String,
  source: RasterImage,
  palette: PaletteSpec,
  transformations: Schema.Array(Transformation),
})
export type Project = typeof Project.Type
