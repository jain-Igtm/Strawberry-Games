import * as THREE from 'three'
import type { EnvironmentMaterials, WeaponPickup } from './environment'
import { buildExpandedTerrain, type TerrainWorld } from './terrain-v5'
import {
  buildWorldObjects,
  type Driveable,
  type QuestPickup,
  type TowerAccess,
  type UpgradeMachine,
  type WalkableZone,
} from './world-objects-v5'

export type ExpandedWorldContext = {
  scene: THREE.Scene
  materials: EnvironmentMaterials
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

export function buildWorldExpansion(context: ExpandedWorldContext): ExpandedWorld {
  const terrain = buildExpandedTerrain({
    scene: context.scene,
    materials: context.materials,
  })
  const objects = buildWorldObjects(context)

  const isInWalkableZone = (x: number, z: number): boolean => {
    return objects.walkableZones.some((zone) => (
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
    towers: objects.towers,
    questPickups: objects.questPickups,
    vehicles: objects.vehicles,
    upgradeMachine: objects.upgradeMachine,
    weaponPickups: objects.weaponPickups,
    walkableZones: objects.walkableZones,
    isWalkableAt,
    isNearLand,
    update: objects.update,
  }
}
