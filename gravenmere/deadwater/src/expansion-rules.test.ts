import { describe, expect, it } from 'vitest'
import {
  LOOK_SENSITIVITIES,
  canRepairBoat,
  nextSensitivityIndex,
  opticForUpgrade,
  upgradeCost,
  weaponDamageMultiplier,
  weaponMagazineSize,
} from './expansion-rules'

describe('Deadwater expansion rules', () => {
  it('cycles through the faster look sensitivity presets', () => {
    expect(LOOK_SENSITIVITIES[1]).toBeGreaterThan(1.5)
    expect(nextSensitivityIndex(0)).toBe(1)
    expect(nextSensitivityIndex(LOOK_SENSITIVITIES.length - 1)).toBe(0)
  })

  it('makes weapon upgrades progressively more expensive and stronger', () => {
    expect(upgradeCost(2)).toBeGreaterThan(upgradeCost(0))
    expect(weaponDamageMultiplier(2)).toBeGreaterThan(weaponDamageMultiplier(1))
    expect(weaponMagazineSize(30, 2)).toBeGreaterThan(weaponMagazineSize(30, 1))
    expect(opticForUpgrade(undefined, 1)?.id).toBe('reflex')
    expect(opticForUpgrade(undefined, 2)?.id).toBe('combat')
    expect(opticForUpgrade(undefined, 5)?.id).toBe('reflex')
  })

  it('requires all three boat repair items', () => {
    expect(canRepairBoat(new Set(['propeller', 'fuel-cell']))).toBe(false)
    expect(canRepairBoat(new Set(['propeller', 'fuel-cell', 'toolkit']))).toBe(true)
  })
})
