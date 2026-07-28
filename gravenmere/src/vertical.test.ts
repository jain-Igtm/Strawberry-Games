import { describe, expect, it } from 'vitest'
import {
  flatSurface,
  rampSurface,
  resolveWorldFloorHeight,
  sampleFloorHeight,
} from './vertical'

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

  it('keeps the original school and keep on continuous ground', () => {
    expect(resolveWorldFloorHeight([], [], 0, 114, 0, false)).toBe(0)
    expect(resolveWorldFloorHeight([], [], 72, 18, 0, false)).toBe(0)
  })

  it('allows actual voids only inside the streamed endless realm', () => {
    expect(resolveWorldFloorHeight([], [], 190, 10, 14, true)).toBeNull()
    const bridge = flatSurface(190, 0, 18, 2.4, 14)
    expect(resolveWorldFloorHeight([bridge], [], 190, 0, 14, true)).toBe(14)
  })
})
