import { Result, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import type { Floss, FlossCatalogue, FlossInput } from './model'

export const CatalogueError = defineTaggedUnion({
  DuplicateFlossNumber: { brand: Schema.String, number: Schema.String },
  FlossNotInCatalogue: { brand: Schema.String, number: Schema.String },
})
export type CatalogueError = typeof CatalogueError.Type

const hasIdentity = (
  entries: ReadonlyArray<Floss>,
  brand: string,
  number: string,
): boolean =>
  entries.some(entry => entry.brand === brand && entry.number === number)

export const addFloss = (
  catalogue: FlossCatalogue,
  input: FlossInput,
): Result.Result<FlossCatalogue, CatalogueError> => {
  if (hasIdentity(catalogue.entries, input.brand, input.number)) {
    return Result.fail(
      CatalogueError.DuplicateFlossNumber({
        brand: input.brand,
        number: input.number,
      }),
    )
  }
  return Result.succeed({
    entries: [
      ...catalogue.entries,
      {
        brand: input.brand,
        number: input.number,
        name: input.name,
        colour: input.colour,
      },
    ],
  })
}

export const editFloss = (
  catalogue: FlossCatalogue,
  floss: Floss,
  updates: Readonly<{ name: string; colour: Floss['colour'] }>,
): Result.Result<FlossCatalogue, CatalogueError> => {
  if (!hasIdentity(catalogue.entries, floss.brand, floss.number)) {
    return Result.fail(
      CatalogueError.FlossNotInCatalogue({
        brand: floss.brand,
        number: floss.number,
      }),
    )
  }
  return Result.succeed({
    entries: catalogue.entries.map(entry =>
      entry.brand === floss.brand && entry.number === floss.number
        ? { ...entry, name: updates.name, colour: updates.colour }
        : entry,
    ),
  })
}

export const removeFloss = (
  catalogue: FlossCatalogue,
  floss: Floss,
): Result.Result<FlossCatalogue, CatalogueError> => {
  if (!hasIdentity(catalogue.entries, floss.brand, floss.number)) {
    return Result.fail(
      CatalogueError.FlossNotInCatalogue({
        brand: floss.brand,
        number: floss.number,
      }),
    )
  }
  return Result.succeed({
    entries: catalogue.entries.filter(
      entry => !(entry.brand === floss.brand && entry.number === floss.number),
    ),
  })
}
