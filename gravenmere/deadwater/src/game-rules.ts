export type ZombieTuning = {
  health: number
  speed: number
  damage: number
  attackDelay: number
}

export function zombiesForWave(wave: number): number {
  const safeWave = Math.max(1, Math.floor(wave))
  return Math.min(54, 7 + safeWave * 3 + Math.floor(safeWave * safeWave * 0.16))
}

export function tuningForWave(wave: number): ZombieTuning {
  const safeWave = Math.max(1, wave)
  return {
    health: Math.round(150 * Math.pow(1.11, safeWave - 1)),
    speed: Math.min(3.45, 1.28 + safeWave * 0.085),
    damage: Math.min(34, 8 + safeWave * 1.35),
    attackDelay: Math.max(0.38, 0.78 - safeWave * 0.018),
  }
}

export function spawnIntervalForWave(wave: number): number {
  return Math.max(0.24, 0.88 - Math.max(1, wave) * 0.035)
}

export function pointsForHit(headshot: boolean, killed: boolean): number {
  if (killed) return headshot ? 160 : 100
  return headshot ? 20 : 10
}

export function reserveAmmoAfterWave(current: number, wave: number): number {
  return Math.min(360, current + 75 + Math.min(90, wave * 5))
}
