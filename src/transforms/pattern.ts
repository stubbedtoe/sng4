import { Option } from 'effect'

import { CONVERTER_CONFIG } from '../converter/config'
import {
  computeFinishedDimensions,
  estimateSkeins,
  suggestFabric,
} from '../converter/dimensions'
import type { Palette, Pattern } from '../converter/model'
import { type IndexedImage, renderIndexedPixels } from './indexed'
import { assignSymbols } from './symbols'

export interface BuildPatternInput {
  readonly indexed: IndexedImage
  readonly palette: Palette
  readonly fabricCount: number
}

export const buildPattern = (input: BuildPatternInput): Pattern => {
  const { indexed, palette } = input
  const { width, height, indices } = indexed

  const key = assignSymbols(palette.entries)

  const cells = new Array<Pattern['cells'][number]>(width * height)
  for (let index = 0; index < width * height; index++) {
    const colourIndex = indices[index] ?? 0
    const floss = palette.entries[colourIndex]
    cells[index] = {
      x: (index % width) + 1,
      y: Math.floor(index / width) + 1,
      symbol: key[colourIndex]?.symbol ?? '?',
      floss: floss ?? {
        brand: 'Unknown',
        number: '?',
        name: 'Unknown',
        colour: { red: 0, green: 0, blue: 0 },
      },
    }
  }

  const histogram = new Uint32Array(palette.entries.length)
  for (let index = 0; index < indices.length; index++) {
    const colourIndex = indices[index] ?? 0
    histogram[colourIndex] = (histogram[colourIndex] ?? 0) + 1
  }

  const usage = palette.entries
    .map((floss, colourIndex) => ({
      floss,
      stitchCount: histogram[colourIndex] ?? 0,
    }))
    .filter(entry => entry.stitchCount > 0)
    .map(entry => ({
      floss: entry.floss,
      stitchCount: entry.stitchCount,
      skeins: estimateSkeins(
        entry.stitchCount,
        CONVERTER_CONFIG.strands_per_stitch,
        CONVERTER_CONFIG.skein_length_m,
      ),
    }))

  const stitchDimensions = { width, height }
  const finishedDimensions = computeFinishedDimensions(
    stitchDimensions,
    input.fabricCount,
  )

  return {
    stitchDimensions,
    finishedDimensions,
    estimateBasis: {
      fabricCount: input.fabricCount,
      strands: CONVERTER_CONFIG.strands_per_stitch,
      skeinLengthM: CONVERTER_CONFIG.skein_length_m,
    },
    suggestedFabric: suggestFabric(
      stitchDimensions,
      input.fabricCount,
      CONVERTER_CONFIG.fabric_margin_cm,
    ),
    preview: {
      width,
      height,
      hasTransparency: false,
      format: 'PNG',
      maybePixels: Option.some({
        width,
        height,
        data: renderIndexedPixels(
          indexed,
          palette.entries.map(entry => entry.colour),
        ),
      }),
    },
    cells,
    key,
    usage,
    palette,
  }
}
