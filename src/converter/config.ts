import { Colour } from './model'

const acceptedImageFormats: ReadonlyArray<string> = ['JPEG', 'PNG', 'WebP']

export const CONVERTER_CONFIG = {
  default_fabric_count: 14,
  default_dithering: true,
  default_background: Colour.make({ red: 255, green: 255, blue: 255 }),
  skein_length_m: 8,
  strands_per_stitch: 2,
  fabric_margin_cm: 7.62,
  max_pattern_side: 500,
  max_source_side: 8000,
  min_colours: 1,
  max_colours: 60,
  accepted_image_formats: acceptedImageFormats,
} as const

export type ConverterConfig = typeof CONVERTER_CONFIG
