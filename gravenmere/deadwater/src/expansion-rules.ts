export const LOOK_SENSITIVITIES = [1.15, 1.6, 2.05] as const

export function nextSensitivityIndex(current: number): number {
  return (Math.max(0, Math.floor(current)) + 1) % LOOK_SENSITIVITIES.length
}

export function upgradeCost(level: number): number {
  return 2200 + Math.max(0, Math.floor(level)) * 1800
}

export function weaponDamageMultiplier(level: number): number {
  return 1 + Math.max(0, Math.floor(level)) * 0.48
}

export function weaponMagazineSize(baseMagazineSize: number, level: number): number {
  const safeBase = Math.max(1, Math.floor(baseMagazineSize))
  const safeLevel = Math.max(0, Math.floor(level))
  return Math.round(safeBase * (1 + safeLevel * 0.2))
}

export type UpgradeOptic = {
  id: 'factory' | 'reflex' | 'combat' | 'marksman' | 'scout'
  fov: number
}

const FORGE_OPTICS: readonly UpgradeOptic[] = [
  { id: 'reflex', fov: 52 },
  { id: 'combat', fov: 39 },
  { id: 'marksman', fov: 26 },
  { id: 'scout', fov: 34 },
]

export function opticForUpgrade(
  factoryScopeFov: number | undefined,
  level: number,
): UpgradeOptic | null {
  const safeLevel = Math.max(0, Math.floor(level))
  if (safeLevel === 0) {
    return factoryScopeFov ? { id: 'factory', fov: factoryScopeFov } : null
  }
  return FORGE_OPTICS[(safeLevel - 1) % FORGE_OPTICS.length]
}

export function canRepairBoat(parts: ReadonlySet<string>): boolean {
  return parts.has('propeller') && parts.has('fuel-cell') && parts.has('toolkit')
}
