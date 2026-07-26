import { describe, expect, it } from 'vitest'
import { adaptivePixelRatio, circleIntersectsRect, clampPitch } from './math'

describe('movement helpers', () => {
  it('clamps vertical look to a playable range', () => {
    expect(clampPitch(9)).toBe(1.08)
    expect(clampPitch(-9)).toBe(-1.24)
    expect(clampPitch(0.4)).toBe(0.4)
  })

  it('detects a circular player against an enabled wall', () => {
    const wall = { minX: 0, maxX: 1, minZ: 0, maxZ: 4, enabled: true }
    expect(circleIntersectsRect(-0.2, 2, 0.35, wall)).toBe(true)
    expect(circleIntersectsRect(-1, 2, 0.35, wall)).toBe(false)
    wall.enabled = false
    expect(circleIntersectsRect(0.5, 2, 0.35, wall)).toBe(false)
  })

  it('reduces render resolution under sustained load', () => {
    expect(adaptivePixelRatio(1.4, 30, 3)).toBeCloseTo(1.3)
    expect(adaptivePixelRatio(1.0, 15, 3)).toBeCloseTo(1.05)
    expect(adaptivePixelRatio(0.85, 40, 3)).toBe(0.85)
  })
})
