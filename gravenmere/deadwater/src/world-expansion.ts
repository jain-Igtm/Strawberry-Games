import * as THREE from 'three'
import type { EnvironmentMaterials, WeaponPickup } from './environment'
import { buildDockTownDistrict } from './districts/dock-town'
import { buildDockTownTerrain, type TerrainWorld } from './districts/dock-town-terrain'
import {
  type Driveable,
  type QuestPickup,
  type TowerAccess,
  type UpgradeMachine,
  type WalkableZone,
} from './world-objects-v5'

export type ExpandedWorldContext = {
  scene: THREE.Scene
  materials: EnvironmentMaterials & {
    island: THREE.MeshStandardMaterial
    water: THREE.MeshStandardMaterial
  }
  shotTargets: THREE.Object3D[]
  addCollider: (x: number, z: number, width: number, depth: number, padding?: number) => void
}

export type ExpandedWorld = TerrainWorld & {
  towers: TowerAccess[]
  questPickups: QuestPickup[]
  vehicles: Driveable[]
  upgradeMachine: UpgradeMachine
  weaponPickups: WeaponPickup[]
  walkableZones: WalkableZone[]
  isWalkableAt: (x: number, z: number) => boolean
  isNearLand: (x: number, z: number, distance?: number) => boolean
  update: (dt: number, elapsed: number) => void
}

function createInactiveUpgradeMachine(): UpgradeMachine {
  const group = new THREE.Group()
  group.position.set(-10_000, -10_000, -10_000)
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.01, 0.01),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  group.add(core)
  return {
    group,
    position: group.position,
    core,
  }
}

export function buildWorldExpansion(context: ExpandedWorldContext): ExpandedWorld {
  const terrain = buildDockTownTerrain({
    scene: context.scene,
    materials: context.materials,
  })
  const dockTown = buildDockTownDistrict(context)
  const walkableZones = dockTown.walkableZones

  const isInWalkableZone = (x: number, z: number): boolean => {
    return walkableZones.some((zone) => (
      x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ
    ))
  }

  const isWalkableAt = (x: number, z: number): boolean => terrain.isLandAt(x, z) || isInWalkableZone(x, z)

  const isNearLand = (x: number, z: number, distance = 4): boolean => {
    if (isWalkableAt(x, z)) return true
    const samples = 12
    for (let index = 0; index < samples; index += 1) {
      const angle = (index / samples) * Math.PI * 2
      if (isWalkableAt(x + Math.cos(angle) * distance, z + Math.sin(angle) * distance)) return true
    }
    return false
  }

  return {
    ...terrain,
    towers: [],
    questPickups: [],
    vehicles: dockTown.vehicles,
    upgradeMachine: createInactiveUpgradeMachine(),
    weaponPickups: [],
    walkableZones,
    isWalkableAt,
    isNearLand,
    update: (dt: number, elapsed: number): void => {
      dockTown.update(dt, elapsed)
    },
  }
}
