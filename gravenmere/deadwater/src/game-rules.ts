export type ZombieTuning = {
  health: number
  speed: number
  damage: number
  attackDelay: number
}

export function zombiesForWave(wave: number): number {
  const safeWave = Math.max(1, Math.floor(wave))
  return Math.min(84, 13 + safeWave * 5 + Math.floor(safeWave * safeWave * 0.2))
}

export function tuningForWave(wave: number): ZombieTuning {
  const safeWave = Math.max(1, wave)
  return {
    health: Math.round(175 * Math.pow(1.14, safeWave - 1)),
    speed: Math.min(6.6, 3 + safeWave * 0.18),
    damage: Math.min(42, 8 + safeWave * 1.5),
    attackDelay: Math.max(0.32, 0.72 - safeWave * 0.02),
  }
}

export function spawnIntervalForWave(wave: number): number {
  return Math.max(0.18, 0.72 - Math.max(1, wave) * 0.03)
}

export function pointsForHit(headshot: boolean, killed: boolean): number {
  if (killed) return headshot ? 160 : 100
  return headshot ? 20 : 10
}

export function reserveAmmoAfterWave(current: number, wave: number): number {
  return Math.min(360, current + 75 + Math.min(90, wave * 5))
}

export function fallDamageForDrop(dropHeight: number): number {
  if (dropHeight <= 2.4) return 0
  return Math.min(18, Math.max(4, Math.ceil((dropHeight - 2.4) * 3)))
}

export function healthAfterRecovery(
  currentHealth: number,
  secondsSinceDamage: number,
  deltaSeconds: number,
): number {
  if (secondsSinceDamage < 4.25 || currentHealth >= 100) return currentHealth
  return Math.min(100, currentHealth + Math.max(0, deltaSeconds) * 5.5)
}
