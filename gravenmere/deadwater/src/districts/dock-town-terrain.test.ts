import { describe, expect, it } from 'vitest'
import { DOCK_TOWN_ROADS } from './dock-town-plan'
import { isLandAt } from './dock-town-terrain'

describe('Dock Town terrain boundary', () => {
  it('contains every authored road control point', () => {
    for (const road of DOCK_TOWN_ROADS) {
      for (const point of road.points) {
        expect(isLandAt(point.x, point.y), `${road.id} at ${point.x},${point.y}`).toBe(true)
      }
    }
  })

  it('does not load adjacent map land', () => {
    expect(isLandAt(76, 80)).toBe(true)
    expect(isLandAt(-40, 132)).toBe(false)
    expect(isLandAt(40, 0)).toBe(false)
    expect(isLandAt(180, 90)).toBe(false)
  })
})
