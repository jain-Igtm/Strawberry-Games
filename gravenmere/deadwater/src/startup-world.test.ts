import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { buildWorldExpansion } from './world-expansion'
import {
  PIXELHOUSE_ZOMBIE_ATTACK_GLB_V18,
  PIXELHOUSE_ZOMBIE_DEATH_GLB_V18,
  PIXELHOUSE_ZOMBIE_WALK_GLB_V18,
} from './generated-assets-v18'
import {
  CASTLE_ROMEO_GRAY_WEBP_V19,
  MUTED_ZOMBIE_DIFFUSE_WEBP_V19,
} from './generated-visual-assets-v19'
import {
  AUTHORED_ZOMBIE_BODY_YAW_V37,
  AUTHORED_ZOMBIE_INDEX_COUNT_V37,
  AUTHORED_ZOMBIE_INDICES_BASE64_V37,
  AUTHORED_ZOMBIE_POSITIONS_BASE64_V37,
  AUTHORED_ZOMBIE_TEXTURE_WEBP_V37,
  AUTHORED_ZOMBIE_UVS_BASE64_V37,
  AUTHORED_ZOMBIE_VERTEX_COUNT_V37,
} from './generated-authored-zombie-v37'
import {
  ZOMBIE_DISPLAY_HEIGHT,
  ZOMBIE_FORWARD_YAW,
} from './zombie-model'

const originalDocument = globalThis.document

function installCanvasDocument(): void {
  const draw = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    lineWidth: 1,
    lineCap: '',
    globalAlpha: 1,
    arc: () => undefined,
    beginPath: () => undefined,
    clearRect: () => undefined,
    closePath: () => undefined,
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    fill: () => undefined,
    fillRect: () => undefined,
    fillText: () => undefined,
    lineTo: () => undefined,
    moveTo: () => undefined,
    stroke: () => undefined,
    strokeRect: () => undefined,
  }
  const canvas = {
    width: 1,
    height: 1,
    getContext: () => draw,
  }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => canvas },
  })
}

afterEach(() => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: originalDocument,
  })
})

describe('production startup geometry', () => {
  it('constructs the optimized town without a synchronous exception', () => {
    installCanvasDocument()
    const scene = new THREE.Scene()
    const colliders: unknown[] = []
    const shotTargets: THREE.Object3D[] = []
    const material = (color: number) => new THREE.MeshStandardMaterial({ color })
    const expansion = buildWorldExpansion({
      scene,
      shotTargets,
      addCollider: (x, z, width, depth, padding) => {
        colliders.push({ x, z, width, depth, padding })
      },
      materials: {
        concrete: material(0x555555),
        cracked: material(0x333333),
        rust: material(0x663322),
        darkRust: material(0x221111),
        metal: material(0x555555),
        blackMetal: material(0x111111),
        warning: material(0xaa6622),
        ember: new THREE.MeshBasicMaterial({ color: 0xff6622 }),
        island: material(0x332211),
        water: material(0x112233),
      },
    })

    expect(scene.children.length).toBeGreaterThan(100)
    expect(colliders.length).toBeGreaterThan(100)
    expect(shotTargets.length).toBeGreaterThan(10)
    expect(expansion.spawnPoints.length).toBeGreaterThan(10)
    expect(expansion.vehicles.length).toBeGreaterThan(0)
  })

  it('packages the post-blast plume and authored static zombie offline', () => {
    expect(ZOMBIE_DISPLAY_HEIGHT).toBeGreaterThanOrEqual(2)
    // The authored body is baked to local -Z, which is the same direction used
    // by main.ts when it converts measured movement into a world yaw.
    expect(ZOMBIE_FORWARD_YAW).toBe(0)
    expect(AUTHORED_ZOMBIE_BODY_YAW_V37).toBe(Math.PI)
    expect(AUTHORED_ZOMBIE_VERTEX_COUNT_V37).toBe(2_169)
    expect(AUTHORED_ZOMBIE_INDEX_COUNT_V37).toBe(10_722)
    expect(atob(AUTHORED_ZOMBIE_POSITIONS_BASE64_V37).length).toBe(
      AUTHORED_ZOMBIE_VERTEX_COUNT_V37 * 3 * 4,
    )
    expect(atob(AUTHORED_ZOMBIE_UVS_BASE64_V37).length).toBe(
      AUTHORED_ZOMBIE_VERTEX_COUNT_V37 * 2 * 4,
    )
    expect(atob(AUTHORED_ZOMBIE_INDICES_BASE64_V37).length).toBe(
      AUTHORED_ZOMBIE_INDEX_COUNT_V37 * 2,
    )
    expect(AUTHORED_ZOMBIE_TEXTURE_WEBP_V37.startsWith('data:image/webp;base64,UklG')).toBe(true)
    expect(AUTHORED_ZOMBIE_TEXTURE_WEBP_V37.length).toBeLessThan(20_000)
    expect(CASTLE_ROMEO_GRAY_WEBP_V19.startsWith('data:image/webp;base64,UklG')).toBe(true)
    expect(MUTED_ZOMBIE_DIFFUSE_WEBP_V19.startsWith('data:image/webp;base64,UklG')).toBe(true)
    for (const glb of [
      PIXELHOUSE_ZOMBIE_WALK_GLB_V18,
      PIXELHOUSE_ZOMBIE_ATTACK_GLB_V18,
      PIXELHOUSE_ZOMBIE_DEATH_GLB_V18,
    ]) {
      expect(glb.startsWith('data:model/gltf-binary;base64,')).toBe(true)
      const header = atob(glb.split(',')[1].slice(0, 8))
      expect(header.slice(0, 4)).toBe('glTF')
      expect(glb.length).toBeLessThan(350_000)
    }
    expect(CASTLE_ROMEO_GRAY_WEBP_V19.length).toBeLessThan(40_000)
    expect(MUTED_ZOMBIE_DIFFUSE_WEBP_V19.length).toBeLessThan(4_000)
  })
})
