export const BASE_INVENTORY = ['lantern', 'field-journal', 'revelare-charm'] as const

export const GROUNDS_CLUES = [
  'grounds-stone-water',
  'grounds-stone-gate',
  'grounds-stone-yew',
] as const

export function normalizeInventory(value: unknown): string[] {
  const inventory: string[] = [...BASE_INVENTORY]
  if (!Array.isArray(value)) return inventory
  for (const item of value) {
    if (typeof item === 'string' && !inventory.includes(item)) {
      inventory.push(item)
    }
  }
  return inventory
}

export function groundsCluesFound(notes: readonly string[]): number {
  return GROUNDS_CLUES.filter((clue) => notes.includes(clue)).length
}

export function canOpenGroundsCache(notes: readonly string[]): boolean {
  return groundsCluesFound(notes) === GROUNDS_CLUES.length
}
