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

export function canRepairBoat(parts: ReadonlySet<string>): boolean {
  return parts.has('propeller') && parts.has('fuel-cell') && parts.has('toolkit')
}
