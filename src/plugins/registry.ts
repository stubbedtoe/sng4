import { Context, Layer, Schema } from 'effect'

import { DitherAlgorithm } from '../domain/Transformation'

export const TransformationBackend = Schema.Literals(['cpu'])
export type TransformationBackend = typeof TransformationBackend.Type

export const TransformationInput = Schema.Literals([
  'image',
  'palette',
  'indexed-image',
])
export type TransformationInput = typeof TransformationInput.Type

/**
 * The contract a transformation plugin declares, whether it ships built in or
 * is supplied externally later. A future plugin manifest resembles
 * `{ id, category, inputs, parameters }`; the built-in registry below uses the
 * same shape so external plugins can join without a second contract.
 */
export interface TransformationDefinition {
  readonly id: string
  readonly category: 'palette-conversion' | 'dithering' | 'pattern'
  readonly version: string
  readonly backend: TransformationBackend
  readonly inputs: ReadonlyArray<TransformationInput>
  readonly parameters: Schema.Top
}

export interface RegistryEntry {
  readonly definition: TransformationDefinition
  readonly label: string
  readonly description: string
}

export const paletteConversionDefinition: TransformationDefinition = {
  id: 'palette-conversion',
  category: 'palette-conversion',
  version: '1.0.0',
  backend: 'cpu',
  inputs: ['image', 'palette'],
  parameters: Schema.Struct({}),
}

export const ditherDefinition: TransformationDefinition = {
  id: 'dither',
  category: 'dithering',
  version: '1.0.0',
  backend: 'cpu',
  inputs: ['image', 'palette'],
  parameters: DitherAlgorithm,
}

export const patternDefinition: TransformationDefinition = {
  id: 'pattern',
  category: 'pattern',
  version: '1.0.0',
  backend: 'cpu',
  inputs: ['indexed-image', 'palette'],
  parameters: Schema.Struct({}),
}

export interface TransformationRegistryService {
  readonly entryFor: (id: string) => RegistryEntry | undefined
  readonly entries: ReadonlyArray<RegistryEntry>
}

const builtInEntries: ReadonlyArray<RegistryEntry> = [
  {
    definition: paletteConversionDefinition,
    label: 'Palette conversion',
    description: 'Snap every stitch to the nearest colour in the palette.',
  },
  {
    definition: ditherDefinition,
    label: 'Dithering',
    description: 'Diffuse quantisation error across neighbouring stitches.',
  },
  {
    definition: patternDefinition,
    label: 'Pattern',
    description: 'Assemble the stitch grid, symbol key, and floss usage.',
  },
]

export class TransformationRegistry extends Context.Service<
  TransformationRegistry,
  TransformationRegistryService
>()('TransformationRegistry') {
  static readonly layerBuiltIn: Layer.Layer<TransformationRegistry> =
    Layer.succeed(TransformationRegistry, {
      entryFor: id => builtInEntries.find(entry => entry.definition.id === id),
      entries: builtInEntries,
    })
}
