import { Array, Option, pipe } from 'effect'

import type { Palette } from './converter/model'

// Seeds for a new custom palette. Real thread catalogues (DMC, Anchor) can
// become another palette source later; until then a custom palette is a list
// of generic colours.

export const SEED_HEXES: Array.NonEmptyReadonlyArray<string> = [
  '#262427',
  '#fcfcfa',
  '#ff7272',
  '#bcdf59',
  '#ffca58',
  '#49cae4',
  '#a093e2',
  '#e06cc0',
  '#3d8b6e',
  '#9e6a3f',
  '#8a869c',
  '#545452',
]

export const seedCustomPalette = (): Palette => ({
  source: 'supplied',
  entries: SEED_HEXES.map((hex, index) => ({
    brand: 'Custom',
    number: `C${index + 1}`,
    name: `Colour ${index + 1}`,
    colour: {
      red: Number.parseInt(hex.slice(1, 3), 16),
      green: Number.parseInt(hex.slice(3, 5), 16),
      blue: Number.parseInt(hex.slice(5, 7), 16),
    },
  })),
})

export const renumberPalette = (palette: Palette): Palette => ({
  source: palette.source,
  entries: palette.entries.map((entry, index) => ({
    ...entry,
    number: `C${index + 1}`,
    name: `Colour ${index + 1}`,
  })),
})

export const paletteHexes = (palette: Palette): ReadonlyArray<string> =>
  palette.entries.map(entry =>
    pipe(
      [entry.colour.red, entry.colour.green, entry.colour.blue],
      channels =>
        `#${channels
          .map(channel =>
            Math.max(0, Math.min(255, Math.round(channel)))
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')}`,
    ),
  )

export const colourToHexString = (colour: {
  red: number
  green: number
  blue: number
}): string =>
  `#${[colour.red, colour.green, colour.blue]
    .map(channel =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

export const hexToColourOption = (
  hex: string,
): Option.Option<Palette['entries'][number]['colour']> => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (match === null || match[1] === undefined) {
    return Option.none()
  }
  const value = match[1]
  return Option.some({
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16),
  })
}

export const colourAt = (
  palette: Palette,
  index: number,
): Option.Option<Palette['entries'][number]> =>
  Array.get(palette.entries, index)
