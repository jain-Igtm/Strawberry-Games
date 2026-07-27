import { describe, expect, it } from 'vitest'
import { flatSurface, rampSurface, sampleFloorHeight } from './vertical'

describe('vertical navigation', () => {
  it('climbs a ramp continuously', () => {
    const ramp = rampSurface(0, 0, 4, 10, 0, 5, 'z', 1)
    expect(sampleFloorHeight([ramp], 0, -5, 0)).toBeCloseTo(0)
    expect(sampleFloorHeight([ramp], 0, 0, 2.5)).toBeCloseTo(2.5)
    expect(sampleFloorHeight([ramp], 0, 5, 5)).toBeCloseTo(5)
  })

  it('selects the nearby level rather than a floor far above', () => {
    const surfaces = [
      flatSurface(0, 0, 10, 10, 0),
      flatSurface(0, 0, 10, 10, 7),
    ]
    expect(sampleFloorHeight(surfaces, 0, 0, 0)).toBe(0)
    expect(sampleFloorHeight(surfaces, 0, 0, 7)).toBe(7)
  })

  it('returns null beyond the edge of a bridge', () => {
    const bridge = flatSurface(0, 0, 12, 2, 14)
    expect(sampleFloorHeight([bridge], 0, 0, 14)).toBe(14)
    expect(sampleFloorHeight([bridge], 0, 2, 14)).toBeNull()
  })
})
