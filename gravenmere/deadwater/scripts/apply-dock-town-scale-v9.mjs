import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve(import.meta.dirname, '../src/districts/dock-town.ts')
let source = readFileSync(sourcePath, 'utf8')
const marker = '// DEADWATER_DOCK_TOWN_SCALE_V9'

if (source.includes(marker)) {
  console.log('Dock Town scale v9 already applied.')
  process.exit(0)
}

function replaceRequired(label, search, replacement) {
  const next = source.replace(search, replacement)
  if (next === source) throw new Error(`Could not apply Dock Town scale v9: ${label}`)
  source = next
}

replaceRequired(
  'forest-plan import and marker',
  `  DOCK_TOWN_ROADS,
  TRANSMISSION_FIELD,`,
  `  DOCK_TOWN_ROADS,
  IMPASSABLE_FOREST,
  TRANSMISSION_FIELD,
  ${marker}`,
)

replaceRequired(
  'insert monumental burning forest builder',
  `function cableBetween(`,
  `function addImpassableBurningForest(
  context: DockTownContext,
  materials: DockTownMaterials,
): Array<{ material: THREE.MeshStandardMaterial; phase: number }> {
  const { x, z, width, depth } = IMPASSABLE_FOREST
  const random = seededRandom(91731)
  const treeCount = 210
  const trunkMaterial = materials.wood.clone()
  trunkMaterial.color.setHex(0x171311)
  const canopyMaterial = materials.leaves.clone()
  canopyMaterial.color.setHex(0x101712)
  const deadCanopyMaterial = materials.deadLeaves.clone()
  deadCanopyMaterial.color.setHex(0x211711)

  const trunkGeometry = new THREE.CylinderGeometry(0.34, 0.58, 9.4, 6)
  const canopyGeometry = new THREE.ConeGeometry(3.1, 9.6, 7)
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount)
  const living = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, treeCount)
  const dead = new THREE.InstancedMesh(canopyGeometry, deadCanopyMaterial, treeCount)
  const dummy = new THREE.Object3D()
  let livingIndex = 0
  let deadIndex = 0

  for (let index = 0; index < treeCount; index += 1) {
    const edgeBias = Math.pow(random(), 0.74)
    const angle = random() * Math.PI * 2
    const radiusX = width * 0.47 * edgeBias
    const radiusZ = depth * 0.47 * edgeBias
    const px = x + Math.cos(angle) * radiusX + (random() - 0.5) * 3.2
    const pz = z + Math.sin(angle) * radiusZ + (random() - 0.5) * 3.2
    const ground = terrainHeightAt(px, pz)
    const scale = 0.88 + random() * 0.82
    const rotation = random() * Math.PI

    dummy.position.set(px, ground + 4.7 * scale, pz)
    dummy.rotation.set(0, rotation, (random() - 0.5) * 0.055)
    dummy.scale.set(scale, scale, scale)
    dummy.updateMatrix()
    trunks.setMatrixAt(index, dummy.matrix)

    dummy.position.y = ground + 10.1 * scale
    dummy.rotation.set(0, rotation, 0)
    dummy.scale.set(scale, scale, scale)
    dummy.updateMatrix()
    if (random() < 0.24) {
      dead.setMatrixAt(deadIndex, dummy.matrix)
      deadIndex += 1
    } else {
      living.setMatrixAt(livingIndex, dummy.matrix)
      livingIndex += 1
    }
  }

  living.count = livingIndex
  dead.count = deadIndex
  trunks.instanceMatrix.needsUpdate = true
  living.instanceMatrix.needsUpdate = true
  dead.instanceMatrix.needsUpdate = true
  context.scene.add(trunks, living, dead)

  // Opaque inner masses make the forest read as miles deep without building a
  // traversable interior. They sit behind the outer trunks rather than forming
  // a visible wall at the roadside.
  const shadowMaterial = new THREE.MeshStandardMaterial({
    color: 0x090d0a,
    roughness: 1,
    flatShading: true,
  })
  const shadowClusters = [
    { dx: -8, dz: -7, sx: 11, sy: 9, sz: 14 },
    { dx: 7, dz: -5, sx: 12, sy: 11, sz: 13 },
    { dx: -5, dz: 8, sx: 13, sy: 10, sz: 14 },
    { dx: 8, dz: 9, sx: 11, sy: 12, sz: 12 },
  ]
  for (const cluster of shadowClusters) {
    const mass = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 6), shadowMaterial)
    mass.position.set(x + cluster.dx, 7.2, z + cluster.dz)
    mass.scale.set(cluster.sx, cluster.sy, cluster.sz)
    context.scene.add(mass)
  }

  const firePockets: Array<{ material: THREE.MeshStandardMaterial; phase: number }> = []
  const smokeMaterial = new THREE.MeshBasicMaterial({
    color: 0x100d0b,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  })
  for (let index = 0; index < 15; index += 1) {
    const px = x + (random() - 0.5) * width * 0.58
    const pz = z + (random() - 0.5) * depth * 0.62
    const ground = terrainHeightAt(px, pz)
    const fireMaterial = new THREE.MeshStandardMaterial({
      color: 0x7c2414,
      emissive: 0xff4a18,
      emissiveIntensity: 1.15 + random() * 0.75,
      roughness: 0.72,
    })
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.65 + random() * 0.55, 2.8 + random() * 2.7, 6), fireMaterial)
    flame.position.set(px, ground + 1.5 + random() * 0.8, pz)
    flame.rotation.y = random() * Math.PI
    context.scene.add(flame)
    firePockets.push({ material: fireMaterial, phase: random() * Math.PI * 2 })

    const smoke = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), smokeMaterial)
    smoke.position.set(px + (random() - 0.5), ground + 6.5 + random() * 5.5, pz + (random() - 0.5))
    const smokeScale = 1.7 + random() * 2.5
    smoke.scale.set(smokeScale, smokeScale * 1.5, smokeScale)
    context.scene.add(smoke)
  }

  // The forest is an authored obstacle. Roads wrap around this physical mass.
  context.addCollider(x, z, width * 0.94, depth * 0.94, 0.8)
  return firePockets
}

function cableBetween(`,
)

replaceRequired(
  'reposition downtown around visible water tower',
  `  addClosedBuilding(context, materials, 70, 89, 12, 14, 4, 'HARBOR HOUSE', materials.brick)
  addClosedBuilding(context, materials, 86, 90, 13, 15, 5, 'MARINER HOTEL', materials.concrete)
  addEnterableBuilding(context, materials, 58, 87, 11, 12, 3, 'HARBOR SUPPLY', materials.painted)
  addEnterableBuilding(context, materials, 82, 111, 13, 13, 3, 'DOCK EXCHANGE', materials.brick)
  addClosedBuilding(context, materials, 99, 91, 11, 13, 3, 'TIDE BUILDING', materials.painted)`,
  `  addClosedBuilding(context, materials, 82, 89, 12, 14, 4, 'HARBOR HOUSE', materials.brick)
  addClosedBuilding(context, materials, 98, 90, 13, 15, 5, 'MARINER HOTEL', materials.concrete)
  addEnterableBuilding(context, materials, 58, 87, 11, 12, 3, 'HARBOR SUPPLY', materials.painted)
  addEnterableBuilding(context, materials, 88, 112, 13, 13, 3, 'DOCK EXCHANGE', materials.brick)
  addClosedBuilding(context, materials, 112, 91, 11, 13, 3, 'TIDE BUILDING', materials.painted)`,
)

replaceRequired(
  'move warehouses to west side of internal forest',
  `  addEnterableBuilding(context, materials, 22, 113, 17, 15, 2, 'WAREHOUSE ONE', materials.concrete)
  addClosedBuilding(context, materials, 34, 118, 15, 12, 2, 'NET & CABLE', materials.brick)
  addClosedBuilding(context, materials, 18, 94, 14, 12, 2, 'COLD STORAGE', materials.painted)`,
  `  addEnterableBuilding(context, materials, 0, 106, 17, 15, 2, 'WAREHOUSE ONE', materials.concrete)
  addClosedBuilding(context, materials, 7, 122, 15, 12, 2, 'NET & CABLE', materials.brick)
  addClosedBuilding(context, materials, 0, 89, 14, 12, 2, 'COLD STORAGE', materials.painted)`,
)

replaceRequired(
  'replace edge forest with internal monumental forest',
  /  \/\/ Wooded side of Main Street\.[\s\S]*?  context\.addCollider\(131, 119, 10, 20, 0\.2\)\n/,
  `  // The inaccessible forest is inside Dock Town, not on its outer rim. It
  // occupies the land between four named roads and forces navigation around it.
  const forestFire = addImpassableBurningForest(context, materials)

  // Smaller tree belts continue the forest illusion toward the ruined power
  // field without creating another fully blocked region.
  addTreeMass(context, materials, [
    { x: 128, z: 118, width: 19, depth: 23, count: 28, seed: 1204 },
    { x: 112, z: 132, width: 28, depth: 10, count: 20, seed: 1205 },
    { x: 18, z: 67, width: 18, depth: 16, count: 18, seed: 1206 },
  ])
  context.addCollider(132, 119, 10, 20, 0.2)
`,
)

replaceRequired(
  'animate interior fire',
  `    update: () => undefined,`,
  `    update: (_dt, elapsed) => {
      for (const pocket of forestFire) {
        pocket.material.emissiveIntensity = 1.05 + Math.sin(elapsed * 3.2 + pocket.phase) * 0.34
      }
    },`,
)

writeFileSync(sourcePath, source)
console.log('Applied Dock Town v9 internal forest scale and routing revision.')
