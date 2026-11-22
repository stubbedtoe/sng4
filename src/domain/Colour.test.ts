import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'

import { Colour } from '../converter/model'
import {
  OklabColourMatcher,
  colourToHex,
  hexToColour,
  oklabDistance,
  rgbToOklab,
} from './Colour'

const red = Colour.make({ red: 255, green: 0, blue: 0 })
const blue = Colour.make({ red: 0, green: 0, blue: 255 })
const white = Colour.make({ red: 255, green: 255, blue: 255 })
const black = Colour.make({ red: 0, green: 0, blue: 0 })

describe('rgbToOklab', () => {
  test('white maps to high lightness, achromatic', () => {
    const oklab = rgbToOklab(white)
    expect(oklab.l).toBeCloseTo(1, 2)
    expect(oklab.a).toBeCloseTo(0, 3)
    expect(oklab.b).toBeCloseTo(0, 3)
  })

  test('black maps to zero lightness', () => {
    expect(rgbToOklab(black).l).toBeCloseTo(0, 2)
  })

  test('pure red and blue are far apart in both channels', () => {
    const redOklab = rgbToOklab(red)
    const blueOklab = rgbToOklab(blue)
    expect(Math.abs(redOklab.a - blueOklab.a)).toBeGreaterThan(0.1)
  })
})

describe('oklabDistance', () => {
  test('distance is zero for identical colours', () => {
    expect(oklabDistance(rgbToOklab(red), rgbToOklab(red))).toBe(0)
  })

  test('distance is symmetric', () => {
    const forward = oklabDistance(rgbToOklab(red), rgbToOklab(blue))
    const backward = oklabDistance(rgbToOklab(blue), rgbToOklab(red))
    expect(forward).toBeCloseTo(backward, 12)
  })

  test('perceptual ordering: red vs blue beats red vs a darker red', () => {
    const darkRed = Colour.make({ red: 220, green: 10, blue: 10 })
    const nearRed = oklabDistance(rgbToOklab(red), rgbToOklab(darkRed))
    const farBlue = oklabDistance(rgbToOklab(red), rgbToOklab(blue))
    expect(farBlue).toBeGreaterThan(nearRed)
  })
})

describe('OklabColourMatcher', () => {
  const candidates = [black, white] as const

  test('selects the nearest palette colour by OKLab distance', () => {
    const darkGrey = Colour.make({ red: 60, green: 60, blue: 60 })
    expect(OklabColourMatcher.nearestIndex(darkGrey, candidates)).toBe(0)
    expect(OklabColourMatcher.nearestIndex(white, candidates)).toBe(1)
  })

  test('prefers the perceptually closer grey', () => {
    const lightGrey = Colour.make({ red: 200, green: 200, blue: 200 })
    expect(OklabColourMatcher.nearestIndex(lightGrey, candidates)).toBe(1)
    const darkGrey2 = Colour.make({ red: 60, green: 60, blue: 60 })
    expect(OklabColourMatcher.nearestIndex(darkGrey2, candidates)).toBe(0)
  })
})

describe('hex conversion', () => {
  test('colourToHex and hexToColour round-trip', () => {
    const hex = colourToHex(Colour.make({ red: 18, green: 52, blue: 86 }))
    expect(hex).toBe('#123456')
    expect(Effect.runSync(hexToColour('#123456'))).toEqual({
      red: 18,
      green: 52,
      blue: 86,
    })
  })
})
