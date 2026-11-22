import type { Floss, KeyEntry } from '../converter/model'

const SYMBOL_SET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export const symbolAt = (index: number): string => {
  const symbol = SYMBOL_SET.charAt(index)
  return symbol === '' ? '?' : symbol
}

export const assignSymbols = (
  entries: ReadonlyArray<Floss>,
): ReadonlyArray<KeyEntry> =>
  entries.map((floss, index) => ({ symbol: symbolAt(index), floss }))
