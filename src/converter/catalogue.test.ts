import { Option, Result, pipe } from 'effect'
import { describe, expect, test } from 'vitest'

import { addFloss, editFloss, removeFloss } from './catalogue'
import { Colour, Floss, FlossCatalogue, type FlossInput } from './model'

const red = Colour.make({ red: 200, green: 0, blue: 0 })

const flossInput = (
  brand: string,
  number: string,
  name = `Floss ${number}`,
): FlossInput => ({ brand, number, name, colour: red })

const emptyCatalogue = (): FlossCatalogue =>
  FlossCatalogue.make({ entries: [] })

const firstEntry = (catalogue: FlossCatalogue): Floss =>
  Option.getOrThrow(Option.fromNullishOr(catalogue.entries[0]))

describe('AddFloss', () => {
  test('rule-success.AddFloss: a new brand+number is added to the catalogue', () => {
    const result = addFloss(emptyCatalogue(), flossInput('DMC', '310', 'Black'))
    expect(Result.isSuccess(result)).toBe(true)
    const catalogue = Result.getOrThrow(result)
    expect(catalogue.entries).toHaveLength(1)
  })

  test('rule-entity-creation.AddFloss: created entry carries the specified fields', () => {
    const result = addFloss(
      emptyCatalogue(),
      flossInput('DMC', '666', 'Bright Red'),
    )
    const created = Result.getOrThrow(result).entries[0]
    expect(created?.brand).toBe('DMC')
    expect(created?.number).toBe('666')
    expect(created?.name).toBe('Bright Red')
    expect(created?.colour).toEqual(red)
  })

  test('rule-failure.AddFloss: duplicate brand+number is rejected', () => {
    const catalogue = Result.getOrThrow(
      addFloss(emptyCatalogue(), flossInput('DMC', '310')),
    )
    const result = addFloss(catalogue, flossInput('DMC', '310', 'Duplicate'))
    expect(Result.isFailure(result)).toBe(true)
    expect(
      pipe(
        result,
        Result.match({
          onSuccess: () => '',
          onFailure: error => error._tag,
        }),
      ),
    ).toBe('DuplicateFlossNumber')
  })

  test('invariant.FlossNumbersUnique: the same number under a different brand is allowed', () => {
    const dmc = Result.getOrThrow(
      addFloss(emptyCatalogue(), flossInput('DMC', '403')),
    )
    const result = addFloss(dmc, flossInput('Anchor', '403'))
    expect(Result.isSuccess(result)).toBe(true)
    expect(Result.getOrThrow(result).entries).toHaveLength(2)
  })

  test('invariant.FlossNumbersUnique: every pair of entries differs by brand or number', () => {
    const catalogue = Result.getOrThrow(
      addFloss(
        Result.getOrThrow(addFloss(emptyCatalogue(), flossInput('DMC', '310'))),
        flossInput('DMC', '666'),
      ),
    )
    const pairs = catalogue.entries.flatMap((a, index) =>
      catalogue.entries.slice(index + 1).map(b => [a, b] as const),
    )
    expect(
      pairs.every(([a, b]) => a.brand !== b.brand || a.number !== b.number),
    ).toBe(true)
  })
})

describe('EditFloss', () => {
  const with310 = (): FlossCatalogue =>
    Result.getOrThrow(
      addFloss(emptyCatalogue(), flossInput('DMC', '310', 'Old name')),
    )

  test('rule-success.EditFloss: name and colour update, brand and number are untouched', () => {
    const catalogue = with310()
    const blue = Colour.make({ red: 0, green: 0, blue: 200 })
    const result = editFloss(catalogue, firstEntry(catalogue), {
      name: 'New name',
      colour: blue,
    })
    const updated = Result.getOrThrow(result).entries[0]
    expect(updated?.name).toBe('New name')
    expect(updated?.colour).toEqual(blue)
    expect(updated?.brand).toBe('DMC')
    expect(updated?.number).toBe('310')
  })

  test('rule-failure.EditFloss: a floss not in the catalogue is rejected', () => {
    const stranger = Floss.make({ ...flossInput('Anchor', '1'), colour: red })
    const result = editFloss(with310(), stranger, {
      name: 'Renamed',
      colour: red,
    })
    expect(Result.isFailure(result)).toBe(true)
  })
})

describe('RemoveFloss', () => {
  test('rule-success.RemoveFloss: the floss leaves the catalogue', () => {
    const catalogue = Result.getOrThrow(
      addFloss(emptyCatalogue(), flossInput('DMC', '310')),
    )
    const result = removeFloss(catalogue, firstEntry(catalogue))
    expect(Result.getOrThrow(result).entries).toHaveLength(0)
  })

  test('rule-failure.RemoveFloss: a floss not in the catalogue is rejected', () => {
    const catalogue = Result.getOrThrow(
      addFloss(emptyCatalogue(), flossInput('DMC', '310')),
    )
    const stranger = Floss.make({ ...flossInput('Anchor', '1'), colour: red })
    const result = removeFloss(catalogue, stranger)
    expect(Result.isFailure(result)).toBe(true)
  })
})
