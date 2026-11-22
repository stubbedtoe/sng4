import type { Colour, ImagePixels } from '../converter/model'
import { type Oklab, rgbToOklab } from '../domain/Colour'

const MAX_SAMPLES = 100_000

interface SampleBuffer {
  readonly size: number
  readonly values: Float64Array
}

const samplePixels = (pixels: ImagePixels): SampleBuffer => {
  const { width, height, data } = pixels
  const total = width * height
  const stride = Math.max(1, Math.ceil(total / MAX_SAMPLES))
  const sampleCount = Math.ceil(total / stride)

  const values = new Float64Array(sampleCount * 3)
  let written = 0
  for (let index = 0; index < total && written < sampleCount; index += stride) {
    const offset = index * 4
    const oklab = rgbToOklab({
      red: data[offset] ?? 0,
      green: data[offset + 1] ?? 0,
      blue: data[offset + 2] ?? 0,
    })
    values[written * 3] = oklab.l
    values[written * 3 + 1] = oklab.a
    values[written * 3 + 2] = oklab.b
    written++
  }

  return { size: written, values }
}

interface Box {
  start: number
  end: number
}

const channelRange = (
  box: Box,
  samples: SampleBuffer,
  channel: number,
): number => {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  for (let index = box.start; index < box.end; index++) {
    const value = samples.values[index * 3 + channel] ?? 0
    if (value < minimum) {
      minimum = value
    }
    if (value > maximum) {
      maximum = value
    }
  }
  return maximum - minimum
}

const splitBox = (box: Box, samples: SampleBuffer): ReadonlyArray<Box> => {
  const count = box.end - box.start
  if (count <= 1) {
    return [box]
  }

  let widestChannel = 0
  let widestRange = -1
  for (let channel = 0; channel < 3; channel++) {
    const range = channelRange(box, samples, channel)
    if (range > widestRange) {
      widestRange = range
      widestChannel = channel
    }
  }

  const order = Array.from({ length: count }, (_, index) => box.start + index)
  order.sort((first, second) => {
    const a = samples.values[first * 3 + widestChannel] ?? 0
    const b = samples.values[second * 3 + widestChannel] ?? 0
    return a - b
  })

  const reordered = new Float64Array(count * 3)
  order.forEach((source, target) => {
    reordered[target * 3] = samples.values[source * 3] ?? 0
    reordered[target * 3 + 1] = samples.values[source * 3 + 1] ?? 0
    reordered[target * 3 + 2] = samples.values[source * 3 + 2] ?? 0
  })
  for (let index = 0; index < count; index++) {
    samples.values[(box.start + index) * 3] = reordered[index * 3] ?? 0
    samples.values[(box.start + index) * 3 + 1] = reordered[index * 3 + 1] ?? 0
    samples.values[(box.start + index) * 3 + 2] = reordered[index * 3 + 2] ?? 0
  }

  const half = Math.floor(count / 2)
  return [
    { start: box.start, end: box.start + half },
    { start: box.start + half, end: box.end },
  ]
}

const averageBox = (box: Box, samples: SampleBuffer): Oklab => {
  let l = 0
  let a = 0
  let b = 0
  const count = box.end - box.start
  for (let index = box.start; index < box.end; index++) {
    l += samples.values[index * 3] ?? 0
    a += samples.values[index * 3 + 1] ?? 0
    b += samples.values[index * 3 + 2] ?? 0
  }
  return { l: l / count, a: a / count, b: b / count }
}

export const oklabToRgb = (oklab: Oklab): Colour => {
  const longCone =
    (oklab.l + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b) ** 3
  const mediumCone =
    (oklab.l - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b) ** 3
  const shortCone =
    (oklab.l - 0.0894841775 * oklab.a - 1.291485548 * oklab.b) ** 3

  const toSrgb = (value: number): number => {
    const gamma =
      value <= 0.0031308
        ? 12.92 * value
        : 1.055 * Math.pow(value, 1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, gamma)) * 255)
  }

  return {
    red: toSrgb(
      4.0767416621 * longCone -
        3.3077115913 * mediumCone +
        0.2309699292 * shortCone,
    ),
    green: toSrgb(
      -1.2684380046 * longCone +
        2.6097574011 * mediumCone -
        0.3413193965 * shortCone,
    ),
    blue: toSrgb(
      -0.0041960863 * longCone -
        0.7034186147 * mediumCone +
        1.707614701 * shortCone,
    ),
  }
}

export const QUANTIZER_VERSION = 'median-cut-oklab-1.0.0'

export const quantize = (
  pixels: ImagePixels,
  colourCount: number,
): ReadonlyArray<Colour> => {
  const samples = samplePixels(pixels)
  if (samples.size === 0 || colourCount < 1) {
    return []
  }

  let boxes: Array<Box> = [{ start: 0, end: samples.size }]
  while (boxes.length < colourCount) {
    let splittableIndex = -1
    let splittableSize = 1
    for (let index = 0; index < boxes.length; index++) {
      const box = boxes[index]
      if (box !== undefined && box.end - box.start > splittableSize) {
        splittableIndex = index
        splittableSize = box.end - box.start
      }
    }
    if (splittableIndex === -1) {
      break
    }
    const box = boxes[splittableIndex]
    boxes = [
      ...boxes.slice(0, splittableIndex),
      ...splitBox(box ?? { start: 0, end: 0 }, samples),
      ...boxes.slice(splittableIndex + 1),
    ]
  }

  return boxes
    .map(box => oklabToRgb(averageBox(box, samples)))
    .sort((first, second) =>
      first.red === second.red
        ? first.green === second.green
          ? first.blue - second.blue
          : first.green - second.green
        : first.red - second.red,
    )
}
