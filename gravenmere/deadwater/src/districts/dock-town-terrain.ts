import * as THREE from 'three'
import type { EnvironmentMaterials } from '../environment'
import { DOCK_TOWN_BOUNDARY, WATER_TOWER_POSITION } from './dock-town-plan'

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
  if (z < 68 && x < 100) return 'SOUTH NEIGHBORHOOD'
  if (z < 70 && x >= 100) return 'BURNING TREELINE'
  if (x >= 137 && z >= 80 && z < 133) return 'ST. AGNES HOSPITAL'
  if (x >= 94 && x < 130 && z >= 74 && z < 133) return 'BAR DISTRICT'
  if (Math.hypot(x - WATER_TOWER_POSITION.x, z - WATER_TOWER_POSITION.y) < 17) return 'WATER TOWER'
  if (z >= 134 && x >= 137) return 'SHOPPING DISTRICT'
  if (z >= 118 && x < 83) return 'SMALL FACTORIES'
  if (z >= 110 && x < 94) return 'SHIPYARD ROAD'
  return 'MAIN STREET'
}

export function buildDockTownTerrain(context: TerrainBuildContext): TerrainWorld {
  const landMaterial = context.materials.island.clone()
  landMaterial.color.setHex(0x302b23)
  landMaterial.roughness = 1
  context.scene.add(createDistrictLand(landMaterial))

  const spawnCoordinates: Array<[number, number]> = [
    // The southeast group sits immediately behind the visible treeline so
    // zombies appear to emerge from the burning forest onto Main Street.
    [112, 63],
    [130, 66],
    [149, 67],
    [169, 68],
    [190, 67],
    [210, 63],
    // Hospital corridors can become active fronts during later waves.
    [148, 106],
    [176, 106],
    [202, 106],
    [176, 124],
    // Other entrances keep waves circulating through streets and interiors.
    [216, 96],
    [216, 142],
    [209, 181],
    [181, 190],
    [140, 190],
    [101, 190],
    [66, 187],
    [32, 192],
    [1, 182],
    [-7, 139],
    [-5, 80],
    [3, 49],
    [5, 14],
    [43, 6],
    [78, 6],
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
