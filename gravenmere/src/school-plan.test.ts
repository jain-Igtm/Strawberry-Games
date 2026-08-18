import { describe, expect, it } from 'vitest'
import { reachableSpaceIds, schoolPlan } from './school-plan'

describe('school architecture plan', () => {
  it('makes every named space reachable from the gatehouse', () => {
    expect(reachableSpaceIds(schoolPlan).size).toBe(schoolPlan.spaces.length)
  })

  it('keeps all stairs enclosed inside dedicated stair cores', () => {
    const stairSpaces = schoolPlan.spaces.filter((space) => space.kind === 'stair')
    expect(stairSpaces).toHaveLength(schoolPlan.stairCores.length)
    for (const core of schoolPlan.stairCores) {
      const space = stairSpaces.find((candidate) => candidate.id === core.spaceId)
      expect(space).toBeDefined()
      expect(core.enclosed).toBe(true)
      expect(core.serves).toEqual([0, 1, 2])
    }
  })

  it('uses outdoor areas only as enclosed courts and gardens', () => {
    const openSpaces = schoolPlan.spaces.filter((space) => space.openSky)
    expect(openSpaces.map((space) => space.id).sort()).toEqual([
      'founders-court',
      'lantern-court',
      'winter-court',
    ])
    for (const space of openSpaces) {
      expect(['court', 'garden']).toContain(space.kind)
    }
  })

  it('does not allow connections to missing rooms', () => {
    const ids = new Set(schoolPlan.spaces.map((space) => space.id))
    for (const connection of schoolPlan.connections) {
      expect(ids.has(connection.a)).toBe(true)
      expect(ids.has(connection.b)).toBe(true)
      expect(connection.width).toBeGreaterThanOrEqual(4)
    }
  })
})
