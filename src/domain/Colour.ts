import { Context, Effect, Layer, Schema } from 'effect'

import { type Colour, Colour as ColourSchema } from '../converter/model'

// OKLAB

export interface Oklab {
  readonly l: number
  readonly a: number
  readonly b: number
}

const linearizeChannel = (value: number): number => {
  const channel = value / 255
  if (channel <= 0.04045) {
    return channel / 12.92
  }
  return Math.pow((channel + 0.055) / 1.055, 2.4)
}

export const rgbToOklab = (colour: Colour): Oklab => {
  const red = linearizeChannel(colour.red)
  const green = linearizeChannel(colour.green)
  const blue = linearizeChannel(colour.blue)

  const longCone = Math.cbrt(
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue,
  )
  const mediumCone = Math.cbrt(
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue,
  )
  const shortCone = Math.cbrt(
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue,
  )

  return {
    l:
      0.2104542553 * longCone +
      0.793617785 * mediumCone -
      0.0040720468 * shortCone,
    a:
      1.9779984951 * longCone -
      2.428592205 * mediumCone +
      0.4505937099 * shortCone,
    b:
      0.0259040371 * longCone +
      0.7827717662 * mediumCone -
      0.808675766 * shortCone,
  }
}

export const oklabDistance = (first: Oklab, second: Oklab): number => {
  const deltaL = first.l - second.l
  const deltaA = first.a - second.a
  const deltaB = first.b - second.b
  return deltaL * deltaL + deltaA * deltaA + deltaB * deltaB
}

// COLOUR MATCHING

export interface ColourMatcher {
  readonly nearestIndex: (
    colour: Colour,
    candidates: ReadonlyArray<Colour>,
  ) => number
}

export class ColourMatcherService extends Context.Service<
  ColourMatcherService,
  ColourMatcher
>()('ColourMatcherService') {}

const nearestIndexWith = (
  distance: (first: Oklab, second: Oklab) => number,
): ColourMatcher['nearestIndex'] => {
  return (colour, candidates) => {
    const target = rgbToOklab(colour)
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index]
      if (candidate === undefined) {
        continue
      }
      const candidateDistance = distance(target, rgbToOklab(candidate))
      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance
        bestIndex = index
      }
    }
    return bestIndex
  }
}

export const OklabColourMatcher: ColourMatcher = {
  nearestIndex: nearestIndexWith(oklabDistance),
}

export const layerOklabColourMatcher: Layer.Layer<ColourMatcherService> =
  Layer.succeed(ColourMatcherService, OklabColourMatcher)

// HEX

export class InvalidHexColour extends Schema.TaggedError<InvalidHexColour>()(
  'InvalidHexColour',
  { hex: Schema.String },
) {}

export const colourToHex = (colour: Colour): string => {
  const toHex = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(colour.red)}${toHex(colour.green)}${toHex(colour.blue)}`
}

export const hexToColour = (
  hex: string,
): Effect.Effect<Colour, InvalidHexColour> =>
  Effect.gen(function* () {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
    if (match === null || match[1] === undefined) {
      return yield* Effect.fail(InvalidHexColour.make({ hex }))
    }
    const value = match[1]
    return ColourSchema.make({
      red: Number.parseInt(value.slice(0, 2), 16),
      green: Number.parseInt(value.slice(2, 4), 16),
      blue: Number.parseInt(value.slice(4, 6), 16),
    })
  })
