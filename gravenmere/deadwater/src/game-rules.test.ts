import { describe, expect, it } from 'vitest'
import {
  pointsForHit,
  reserveAmmoAfterWave,
  spawnIntervalForWave,
  tuningForWave,
  zombiesForWave,
} from './game-rules'

describe('Deadwater wave rules', () => {
  it('increases pressure without exceeding the mobile zombie cap', () => {
    expect(zombiesForWave(1)).toBeGreaterThanOrEqual(10)
    expect(zombiesForWave(8)).toBeGreaterThan(zombiesForWave(2))
    expect(zombiesForWave(100)).toBe(54)
  })

  it('starts with durable zombies and makes them tougher and faster over time', () => {
    const early = tuningForWave(1)
    const late = tuningForWave(12)
    expect(early.health).toBeGreaterThanOrEqual(140)
    expect(late.health).toBeGreaterThan(early.health)
    expect(late.speed).toBeGreaterThan(early.speed)
    expect(late.damage).toBeGreaterThan(early.damage)
    expect(late.attackDelay).toBeLessThan(early.attackDelay)
  })

  it('keeps spawns and rewards within expected bounds', () => {
    expect(spawnIntervalForWave(30)).toBeGreaterThanOrEqual(0.24)
    expect(pointsForHit(true, true)).toBeGreaterThan(pointsForHit(false, true))
    expect(reserveAmmoAfterWave(350, 20)).toBe(360)
  })
})
