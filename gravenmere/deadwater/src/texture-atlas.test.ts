import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ATLAS_TILES, mapGeometryToAtlas } from './texture-atlas'

describe('texture atlas UV mapping', () => {
  it('keeps geometry inside a tile with a mip-safe inset', () => {
    const geometry = mapGeometryToAtlas(
      new THREE.BoxGeometry(1, 1, 1),
      ATLAS_TILES.topRight,
    )
    const uv = geometry.getAttribute('uv')
    for (let index = 0; index < uv.count; index += 1) {
      expect(uv.getX(index)).toBeGreaterThan(0.5)
      expect(uv.getX(index)).toBeLessThan(1)
      expect(uv.getY(index)).toBeGreaterThan(0.5)
      expect(uv.getY(index)).toBeLessThan(1)
    }
  })
})
