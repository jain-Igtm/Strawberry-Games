import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { buildWorldExpansion } from './world-expansion'
import { createRoundedZombieVisual } from './zombie-model'

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

  it('constructs a one-draw zombie rig', () => {
    const material = (color: number) => new THREE.MeshStandardMaterial({ color })
    const visual = createRoundedZombieVisual({
      skin: material(0x777166),
      cloth: material(0x222222),
      clothAlt: material(0x442222),
      rust: material(0x663322),
      warning: material(0xaa6622),
      ember: new THREE.MeshBasicMaterial({ color: 0xff6622 }),
    })

    expect(visual.parts).toHaveLength(1)
    expect(visual.mesh.skeleton.bones).toHaveLength(6)
    expect(visual.mesh.geometry.boundingSphere).not.toBeNull()
  })
})
