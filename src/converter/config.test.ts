import { describe, expect, test } from 'vitest'

import { CONVERTER_CONFIG } from './config'

describe('config defaults', () => {
  test('config-default.default_fabric_count: declared default', () => {
    expect(CONVERTER_CONFIG.default_fabric_count).toBe(14)
  })

  test('config-default.default_dithering: declared default', () => {
    expect(CONVERTER_CONFIG.default_dithering).toBe(true)
  })

  test('config-default.default_background: declared default', () => {
    expect(CONVERTER_CONFIG.default_background).toEqual({
      red: 255,
      green: 255,
      blue: 255,
    })
  })

  test('config-default.skein_length_m: declared default', () => {
    expect(CONVERTER_CONFIG.skein_length_m).toBe(8)
  })

  test('config-default.strands_per_stitch: declared default', () => {
    expect(CONVERTER_CONFIG.strands_per_stitch).toBe(2)
  })

  test('config-default.fabric_margin_cm: declared default', () => {
    expect(CONVERTER_CONFIG.fabric_margin_cm).toBe(7.62)
  })

  test('config-default.max_pattern_side: declared default', () => {
    expect(CONVERTER_CONFIG.max_pattern_side).toBe(500)
  })

  test('config-default.max_source_side: declared default', () => {
    expect(CONVERTER_CONFIG.max_source_side).toBe(8000)
  })

  test('config-default.min_colours: declared default', () => {
    expect(CONVERTER_CONFIG.min_colours).toBe(1)
  })

  test('config-default.max_colours: declared default', () => {
    expect(CONVERTER_CONFIG.max_colours).toBe(60)
  })

  test('config-default.accepted_image_formats: declared default', () => {
    expect(CONVERTER_CONFIG.accepted_image_formats).toEqual([
      'JPEG',
      'PNG',
      'WebP',
    ])
  })
})
