import { describe, expect, it } from 'vitest'
import {
  BAR_POSITION,
  DOCK_TOWN_ROADS,
  FUEL_STATION_POSITION,
  HOSPITAL_POSITION,
  IMPASSABLE_FOREST,
  WATER_TOWER_POSITION,
} from './dock-town-plan'
import { isLandAt } from './dock-town-terrain'

describe('Town terrain boundary', () => {
  it('contains every authored road control point', () => {
    for (const road of DOCK_TOWN_ROADS) {
      for (const point of road.points) {
        expect(isLandAt(point.x, point.y), `${road.id} at ${point.x},${point.y}`).toBe(true)
      }
    }
  })

  it('does not load adjacent map land', () => {
    expect(isLandAt(76, 80)).toBe(true)
    expect(isLandAt(-40, 157)).toBe(false)
    expect(isLandAt(80, -20)).toBe(false)
    expect(isLandAt(220, 90)).toBe(false)
    expect(isLandAt(80, 190)).toBe(false)
  })

  it('keeps the drawn Town block relationships intact', () => {
    const mainStreet = DOCK_TOWN_ROADS.find((road) => road.id === 'main-street')
    expect(mainStreet?.width).toBeGreaterThanOrEqual(10)
    expect(Math.max(...IMPASSABLE_FOREST.polygon.map((point) => point.y))).toBeLessThan(73)
    expect(HOSPITAL_POSITION.y).toBeGreaterThan(72)
    expect(BAR_POSITION.x).toBeLessThan(HOSPITAL_POSITION.x)
    expect(WATER_TOWER_POSITION.x).toBeLessThan(BAR_POSITION.x)
    expect(FUEL_STATION_POSITION.y).toBeGreaterThan(BAR_POSITION.y)
    expect(DOCK_TOWN_ROADS.every((road) => road.width >= 6.8)).toBe(true)
  })
})
