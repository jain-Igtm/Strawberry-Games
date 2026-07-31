import { describe, expect, it } from 'vitest'
import {
  fallDamageForDrop,
  healthAfterRecovery,
  pointsForHit,
  reserveAmmoAfterWave,
  spawnIntervalForWave,
  tuningForWave,
  zombiesForWave,
} from './game-rules'

describe('Deadwater wave rules', () => {
  it('increases pressure without exceeding the mobile zombie cap', () => {
    expect(zombiesForWave(1)).toBeGreaterThanOrEqual(18)
    expect(zombiesForWave(8)).toBeGreaterThan(zombiesForWave(2))
    expect(zombiesForWave(100)).toBe(84)
  })

  it('starts with durable, mobile zombies and scales them over time', () => {
    const early = tuningForWave(1)
    const late = tuningForWave(12)
    expect(early.health).toBeGreaterThanOrEqual(170)
    expect(early.speed).toBeGreaterThan(3)
    expect(late.health).toBeGreaterThan(early.health)
    expect(late.speed).toBeGreaterThan(early.speed)
    expect(late.damage).toBeGreaterThan(early.damage)
    expect(late.attackDelay).toBeLessThan(early.attackDelay)
  })

  it('keeps spawns and rewards within expected bounds', () => {
    expect(spawnIntervalForWave(30)).toBeGreaterThanOrEqual(0.18)
    expect(pointsForHit(true, true)).toBeGreaterThan(pointsForHit(false, true))
    expect(reserveAmmoAfterWave(350, 20)).toBe(360)
  })

  it('keeps balcony falls mild and begins gradual recovery after a delay', () => {
    expect(fallDamageForDrop(2.2)).toBe(0)
    expect(fallDamageForDrop(3.5)).toBeGreaterThanOrEqual(4)
    expect(fallDamageForDrop(3.5)).toBeLessThan(10)
    expect(healthAfterRecovery(72, 3, 1)).toBe(72)
    expect(healthAfterRecovery(72, 5, 1)).toBeGreaterThan(72)
  })
})
