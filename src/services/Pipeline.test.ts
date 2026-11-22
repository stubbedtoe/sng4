import { Effect, Layer, ManagedRuntime, Option, Result } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'

import { RasterImage } from '../converter/model'
import { PaletteSpec, Project, Transformation } from '../domain/Transformation'
import { TransformationRegistry } from '../plugins/registry'
import { Pipeline, type PipelineOutput } from './Pipeline'
import { PixelStore } from './PixelStore'

// Fixture A: 4x2 greyscale ramp, rows identical. Exact indices are asserted.
const RAMP_PIXELS = {
  width: 4,
  height: 2,
  data: new Uint8Array([
    0, 0, 0, 255, 85, 85, 85, 255, 170, 170, 170, 255, 255, 255, 255, 255, 0, 0,
    0, 255, 85, 85, 85, 255, 170, 170, 170, 255, 255, 255, 255, 255,
  ]),
}

// Fixture B: 4x1 dark grey. Plain conversion snaps every stitch to black;
// Floyd-Steinberg diffusion pushes the last stitch to white.
const GREY_PIXELS = {
  width: 4,
  height: 1,
  data: new Uint8Array([
    60, 60, 60, 255, 60, 60, 60, 255, 60, 60, 60, 255, 60, 60, 60, 255,
  ]),
}

const source: RasterImage = {
  width: 4,
  height: 2,
  hasTransparency: false,
  format: 'PNG',
  maybePixels: Option.none(),
}

const greySource: RasterImage = {
  width: 4,
  height: 1,
  hasTransparency: false,
  format: 'PNG',
  maybePixels: Option.none(),
}

const blackWhitePalette = PaletteSpec.Custom({
  palette: {
    source: 'supplied',
    entries: [
      {
        brand: 'Custom',
        number: 'C1',
        name: 'Colour C1',
        colour: { red: 0, green: 0, blue: 0 },
      },
      {
        brand: 'Custom',
        number: 'C2',
        name: 'Colour C2',
        colour: { red: 255, green: 255, blue: 255 },
      },
    ],
  },
})

const patternStage = Transformation.Pattern({
  targetSide: 'width',
  targetStitches: 4,
  fabricCount: 14,
})

const project = (
  sourceId: string,
  image: RasterImage,
  palette: Project['palette'],
  list: ReadonlyArray<typeof Transformation.Type>,
): Project => ({
  sourceId,
  source: image,
  palette,
  transformations: [...list],
})

const plainRamp = project('ramp-source', source, blackWhitePalette, [
  Transformation.PaletteConversion(),
  Transformation.Dither({ algorithm: 'None' }),
  patternStage,
])

const greyProject = (
  list: ReadonlyArray<typeof Transformation.Type>,
): Project => project('grey-source', greySource, blackWhitePalette, [...list])

const services = Layer.mergeAll(
  PixelStore.layer,
  TransformationRegistry.layerBuiltIn,
  Pipeline.layer.pipe(
    Layer.provide(
      Layer.mergeAll(PixelStore.layer, TransformationRegistry.layerBuiltIn),
    ),
  ),
)

const runtime = ManagedRuntime.make(services)

const run = <A, E>(effect: Effect.Effect<A, E, Pipeline | PixelStore>) =>
  runtime.runPromise(effect)

beforeAll(async () => {
  await run(
    Effect.gen(function* () {
      const store = yield* PixelStore
      yield* store.put('ramp-source', RAMP_PIXELS)
      yield* store.put('grey-source', GREY_PIXELS)
    }),
  )
})

const evaluate = (input: Project) =>
  run(
    Effect.gen(function* () {
      const pipeline = yield* Pipeline
      return yield* Effect.result(pipeline.evaluate(input))
    }),
  )

const evaluateOrThrow = async (input: Project): Promise<PipelineOutput> => {
  const result = await evaluate(input)
  if (Result.isFailure(result)) {
    throw new Error(JSON.stringify(result.failure))
  }
  return result.success
}

describe('Pipeline.evaluate', () => {
  test('converts a synthetic image to exact palette indices', async () => {
    const output = await evaluateOrThrow(plainRamp)
    expect(output.dimensions).toEqual({ width: 4, height: 2 })
    expect(Array.from(output.stitches)).toEqual([0, 0, 1, 1, 0, 0, 1, 1])
    expect(output.pattern.cells).toHaveLength(8)
    expect(output.pattern.cells[0]?.symbol).toBe('A')
    expect(output.pattern.cells[3]?.symbol).toBe('B')
  })

  test('fails without a pattern transformation', async () => {
    const result = await evaluate(
      project('ramp-source', source, blackWhitePalette, [
        Transformation.PaletteConversion(),
      ]),
    )
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe('NoPatternTransformation')
    }
  })

  test('fails without any palette mapping stage', async () => {
    const result = await evaluate(
      project('ramp-source', source, blackWhitePalette, [patternStage]),
    )
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe('NoIndexedImage')
    }
  })

  test('rejects projects that exceed the product limits', async () => {
    const result = await evaluate(
      project('ramp-source', source, blackWhitePalette, [
        Transformation.PaletteConversion(),
        Transformation.Pattern({
          targetSide: 'width',
          targetStitches: 0,
          fabricCount: 14,
        }),
      ]),
    )
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe('ProjectExceedsLimits')
    }
  })

  test('the last mapping stage in the list wins', async () => {
    const plain = await evaluateOrThrow(
      greyProject([
        Transformation.PaletteConversion(),
        Transformation.Dither({ algorithm: 'None' }),
        patternStage,
      ]),
    )
    const convertLast = await evaluateOrThrow(
      greyProject([
        Transformation.Dither({ algorithm: 'FloydSteinberg' }),
        Transformation.PaletteConversion(),
        patternStage,
      ]),
    )
    const ditherLast = await evaluateOrThrow(
      greyProject([
        Transformation.PaletteConversion(),
        Transformation.Dither({ algorithm: 'FloydSteinberg' }),
        patternStage,
      ]),
    )
    expect(Array.from(plain.stitches)).toEqual([0, 0, 0, 0])
    expect(Array.from(convertLast.stitches)).toEqual([0, 0, 0, 0])
    expect(Array.from(ditherLast.stitches)).toEqual([0, 0, 0, 1])
  })
})

describe('Pipeline cache', () => {
  test('returns the same instances when nothing changed', async () => {
    const first = await evaluateOrThrow(plainRamp)
    const second = await evaluateOrThrow(plainRamp)
    expect(second.pattern).toBe(first.pattern)
    expect(second.palette).toBe(first.palette)
  })

  test('changing dithering recomputes only the mapping stage', async () => {
    const plainGrey = greyProject([
      Transformation.PaletteConversion(),
      Transformation.Dither({ algorithm: 'None' }),
      patternStage,
    ])
    const ditheredGrey = greyProject([
      Transformation.PaletteConversion(),
      Transformation.Dither({ algorithm: 'FloydSteinberg' }),
      patternStage,
    ])

    const plain = await evaluateOrThrow(plainGrey)
    const dithered = await evaluateOrThrow(ditheredGrey)
    expect(dithered.pattern).not.toBe(plain.pattern)
    expect(dithered.palette).toBe(plain.palette)

    const plainAgain = await evaluateOrThrow(plainGrey)
    expect(plainAgain.pattern).toBe(plain.pattern)
  })

  test('changing the palette size invalidates the palette but not the source', async () => {
    const extracted8 = project(
      'ramp-source',
      source,
      PaletteSpec.Extracted({ colourCount: 8 }),
      [
        Transformation.PaletteConversion(),
        Transformation.Dither({ algorithm: 'None' }),
        patternStage,
      ],
    )
    const extracted4 = project(
      'ramp-source',
      source,
      PaletteSpec.Extracted({ colourCount: 4 }),
      [
        Transformation.PaletteConversion(),
        Transformation.Dither({ algorithm: 'None' }),
        patternStage,
      ],
    )

    const first = await evaluateOrThrow(extracted8)
    const second = await evaluateOrThrow(extracted4)
    expect(second.palette).not.toBe(first.palette)

    const third = await evaluateOrThrow(extracted8)
    expect(third.palette).toBe(first.palette)
  })
})
