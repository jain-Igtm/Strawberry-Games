import { describe, expect, it } from 'vitest'
import {
  BASE_INVENTORY,
  canOpenGroundsCache,
  groundsCluesFound,
  normalizeInventory,
} from './progress'

describe('inventory migration', () => {
  it('gives old saves every base item', () => {
    expect(normalizeInventory(undefined)).toEqual(BASE_INVENTORY)
  })

  it('preserves unique discovered items', () => {
    expect(normalizeInventory(['wayfinder', 'wayfinder', 4])).toEqual([
      ...BASE_INVENTORY,
      'wayfinder',
    ])
  })
})

describe('outer grounds puzzle', () => {
  it('counts unique required clues and unlocks only when all are recorded', () => {
    const partial = ['grounds-stone-water', 'grounds-stone-water', 'unrelated-note']
    expect(groundsCluesFound(partial)).toBe(1)
    expect(canOpenGroundsCache(partial)).toBe(false)
    expect(
      canOpenGroundsCache([
        'grounds-stone-water',
        'grounds-stone-gate',
        'grounds-stone-yew',
      ]),
    ).toBe(true)
  })
})
