import * as THREE from 'three'
import type { EnvironmentMaterials } from '../environment'
import { DOCK_TOWN_BOUNDARY } from './dock-town-plan'

export type TerrainBuildContext = {
  scene: THREE.Scene
  materials: EnvironmentMaterials & {
    island: THREE.MeshStandardMaterial
    water: THREE.MeshStandardMaterial
  }
}

export type TerrainWorld = {
  spawnPoints: THREE.Vector3[]
  heightAt: (x: number, z: number) => number
  isLandAt: (x: number, z: number) => boolean
  isMainLandAt: (x: number, z: number) => boolean
  canBoatAt: (x: number, z: number) => boolean
  districtAt: (x: number, z: number) => string
}

function pointInsideBoundary(x: number, z: number): boolean {
  let inside = false
  for (
    let current = 0, previous = DOCK_TOWN_BOUNDARY.length - 1;
    current < DOCK_TOWN_BOUNDARY.length;
    previous = current, current += 1
  ) {
    const a = DOCK_TOWN_BOUNDARY[current]
    const b = DOCK_TOWN_BOUNDARY[previous]
    const crosses =
      a.y > z !== b.y > z &&
      x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y + Number.EPSILON) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

export function isMainLandAt(x: number, z: number): boolean {
  return pointInsideBoundary(x, z)
}

export function isLandAt(x: number, z: number): boolean {
  return isMainLandAt(x, z)
}

export function terrainHeightAt(x: number, z: number): number {
  if (!isLandAt(x, z)) return 0
  return 0.12 + Math.sin(x * 0.055) * 0.025 + Math.cos(z * 0.047) * 0.02
}

function createDistrictLand(material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape()
  shape.moveTo(DOCK_TOWN_BOUNDARY[0].x, DOCK_TOWN_BOUNDARY[0].y)
  for (let index = 1; index < DOCK_TOWN_BOUNDARY.length; index += 1) {
    shape.lineTo(DOCK_TOWN_BOUNDARY[index].x, DOCK_TOWN_BOUNDARY[index].y)
  }
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 2.2,
    bevelEnabled: false,
    curveSegments: 1,
  })
  geometry.computeVertexNormals()
  const land = new THREE.Mesh(geometry, material)
  land.rotation.x = Math.PI / 2
  land.position.y = 0.08
  return land
}

function districtAt(x: number, z: number): string {
  if (Math.hypot(x - 67, z - 106) < 13) return 'WATER TOWER'
  if (z >= 122) return 'HARBOR ROAD'
  if (x <= 30 && z >= 82) return 'WAREHOUSE QUARTER'
  if (x >= 107 && z >= 96) return 'ADMIN FIELD'
  if (z <= 74 && x >= 60) return 'SOUTH NEIGHBORHOOD'
  if (x >= 62 && z >= 76 && z <= 119) return 'DOWNTOWN'
  return 'DOCK TOWN'
}

export function buildDockTownTerrain(context: TerrainBuildContext): TerrainWorld {
  const landMaterial = context.materials.island.clone()
  landMaterial.color.setHex(0x302b23)
  landMaterial.roughness = 1
  context.scene.add(createDistrictLand(landMaterial))

  const spawnCoordinates: Array<[number, number]> = [
    [-3, 83],
    [-5, 111],
    [4, 132],
    [28, 138],
    [73, 138],
    [108, 132],
    [132, 116],
    [138, 92],
    [131, 72],
    [112, 55],
    [91, 48],
    [64, 48],
    [35, 54],
    [10, 68],
  ]
  const spawnPoints = spawnCoordinates
    .filter(([x, z]) => isLandAt(x, z))
    .map(([x, z]) => new THREE.Vector3(x, terrainHeightAt(x, z), z))

  return {
    spawnPoints,
    heightAt: terrainHeightAt,
    isLandAt,
    isMainLandAt,
    canBoatAt: () => false,
    districtAt,
  }
}
