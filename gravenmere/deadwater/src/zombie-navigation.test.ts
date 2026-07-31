import { describe, expect, it } from 'vitest'
import {
  circleIntersectsBounds,
  lerpRadians,
  moveCircleSwept,
} from './zombie-navigation'

describe('zombie collision movement', () => {
  it('cannot tunnel through a wall during a long frame', () => {
    const wall = {
      minX: -0.08,
      maxX: 0.08,
      minZ: -4,
      maxZ: 4,
    }
    const position = { x: -1, z: 0 }
    moveCircleSwept(
      position,
      2.4,
      0,
      0.44,
      () => true,
      (x, z, radius) => circleIntersectsBounds(x, z, radius, wall),
    )

    expect(position.x).toBeLessThanOrEqual(wall.minX - 0.44)
  })

  it('slides along a wall without crossing it', () => {
    const wall = {
      minX: -0.08,
      maxX: 0.08,
      minZ: -4,
      maxZ: 4,
    }
    const position = { x: -0.7, z: -1.2 }
    moveCircleSwept(
      position,
      0.9,
      1.1,
      0.44,
      () => true,
      (x, z, radius) => circleIntersectsBounds(x, z, radius, wall),
    )

    expect(position.x).toBeLessThanOrEqual(wall.minX - 0.44)
    expect(position.z).toBeGreaterThan(-1.2)
  })

  it('takes the shortest turn across the angle wrap', () => {
    const result = lerpRadians(Math.PI - 0.08, -Math.PI + 0.08, 0.5)
    expect(Math.abs(Math.abs(result) - Math.PI)).toBeLessThan(0.09)
  })
})
