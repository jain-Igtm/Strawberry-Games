import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve(import.meta.dirname, '../src/environment.ts')
let source = readFileSync(sourcePath, 'utf8')
const marker = '// DEADWATER_ENTERABLE_BUILDINGS_V5'

if (source.includes(marker)) {
  console.log('Deadwater enterable building pass already applied.')
  process.exit(0)
}

const pattern = /function addServiceBuilding\([\s\S]*?\n}\n\nfunction addPipeBridge/
const replacement = `${marker}
function addServiceBuilding(
  context: BuildContext,
  x: number,
  z: number,
  width: number,
  depth: number,
  name: string,
  rotation = 0,
): void {
  const { materials, scene } = context
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotation

  const addWall = (
    wallWidth: number,
    wallHeight: number,
    wallDepth: number,
    localX: number,
    localY: number,
    localZ: number,
    material: THREE.Material,
  ): void => {
    const wall = box(wallWidth, wallHeight, wallDepth, material, localX, localY, localZ)
    wall.userData.blocksShot = true
    group.add(wall)
    context.shotTargets.push(wall)
    const cosine = Math.cos(rotation)
    const sine = Math.sin(rotation)
    const centerX = x + localX * cosine + localZ * sine
    const centerZ = z - localX * sine + localZ * cosine
    const rotated = Math.abs(sine) > 0.5
    context.addCollider(
      centerX,
      centerZ,
      rotated ? wallDepth : wallWidth,
      rotated ? wallWidth : wallDepth,
      0.06,
    )
  }

  const wallHeight = 4.8
  const thickness = 0.28
  const doorway = 2.35
  const frontSegment = (width - doorway) / 2
  const floor = box(width, 0.2, depth, materials.concrete, 0, 0.1, 0)
  const roof = box(width + 0.7, 0.34, depth + 0.7, materials.blackMetal, 0, 4.94, 0)
  group.add(floor, roof)

  addWall(width, wallHeight, thickness, 0, 2.5, depth / 2, materials.darkRust)
  addWall(thickness, wallHeight, depth, -width / 2, 2.5, 0, materials.darkRust)
  addWall(thickness, wallHeight, depth, width / 2, 2.5, 0, materials.darkRust)
  addWall(
    frontSegment,
    wallHeight,
    thickness,
    -width / 2 + frontSegment / 2,
    2.5,
    -depth / 2,
    materials.rust,
  )
  addWall(
    frontSegment,
    wallHeight,
    thickness,
    width / 2 - frontSegment / 2,
    2.5,
    -depth / 2,
    materials.rust,
  )

  const awning = box(3.6, 0.18, 1.25, materials.metal, 0, 3.25, -depth / 2 - 0.56)
  awning.rotation.x = -0.08
  const vent = cylinder(0.46, 0.46, 1.6, 10, materials.metal, width * 0.28, 5.75, 0)
  const ventCap = cylinder(0.68, 0.45, 0.4, 10, materials.rust, width * 0.28, 6.65, 0)
  const sign = box(
    Math.min(width - 1.2, 6.7),
    1.05,
    0.14,
    makeLabelMaterial(name, 0x9f4829),
    0,
    3.9,
    -depth / 2 - 0.13,
  )
  group.add(awning, vent, ventCap, sign)

  const paneMaterial = new THREE.MeshStandardMaterial({
    color: 0x251816,
    emissive: 0x5b1d0f,
    emissiveIntensity: 0.48,
    roughness: 0.35,
    metalness: 0.1,
  })
  for (const side of [-1, 1]) {
    const windowFrame = box(1.35, 1.25, 0.16, materials.metal, side * width * 0.27, 2.65, -depth / 2 - 0.11)
    const pane = box(1.05, 0.95, 0.18, paneMaterial, side * width * 0.27, 2.65, -depth / 2 - 0.21)
    group.add(windowFrame, pane)
  }

  group.add(box(1.8, 0.9, 0.8, materials.blackMetal, -width * 0.24, 0.55, depth * 0.18))
  group.add(box(1.1, 1.45, 1.1, materials.metal, width * 0.26, 0.74, depth * 0.16))
  const ceilingLight = new THREE.MeshStandardMaterial({
    color: 0xb84c26,
    emissive: 0xff4b1c,
    emissiveIntensity: 1.1,
    roughness: 0.42,
  })
  group.add(box(1.3, 0.11, 0.38, ceilingLight, 0, 4.45, 0))
  scene.add(group)
}

function addPipeBridge`

const next = source.replace(pattern, replacement)
if (next === source) throw new Error('Could not patch service buildings for v5.')
writeFileSync(sourcePath, next)
console.log('Applied Deadwater enterable building pass v5.')
