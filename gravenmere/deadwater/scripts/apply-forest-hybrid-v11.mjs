import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve(import.meta.dirname, '../src/districts/dock-town.ts')
let source = readFileSync(sourcePath, 'utf8')
const marker = '// DEADWATER_FOREST_HYBRID_V11'

if (source.includes(marker)) {
  console.log('Deadwater hybrid forest v11 already applied.')
  process.exit(0)
}

const replacement = `function addImpassableBurningForest(
  context: DockTownContext,
  materials: DockTownMaterials,
): Array<{ material: THREE.MeshStandardMaterial; phase: number }> {
  ${marker}
  const { x, z, width, depth } = IMPASSABLE_FOREST
  const random = seededRandom(662311)

  // The forest remains a physical authored obstacle, but its visible edge is now
  // made from a small number of instanced, layered conifers. This keeps real depth
  // and parallax at road level without rebuilding the inaccessible interior.
  const treeCount = 86
  const trees: Array<{ x: number; z: number; scale: number; rotation: number; dead: boolean }> = []

  for (let index = 0; index < 62; index += 1) {
    const edge = index % 4
    let px = x
    let pz = z
    if (edge === 0) {
      px += (random() - 0.5) * width * 0.96
      pz += -depth * 0.46 + random() * 4.5
    } else if (edge === 1) {
      px += width * 0.46 - random() * 4.5
      pz += (random() - 0.5) * depth * 0.96
    } else if (edge === 2) {
      px += (random() - 0.5) * width * 0.96
      pz += depth * 0.46 - random() * 4.5
    } else {
      px += -width * 0.46 + random() * 4.5
      pz += (random() - 0.5) * depth * 0.96
    }
    trees.push({
      x: px,
      z: pz,
      scale: 0.84 + random() * 0.62,
      rotation: random() * Math.PI,
      dead: random() < 0.16,
    })
  }

  for (let index = trees.length; index < treeCount; index += 1) {
    trees.push({
      x: x + (random() - 0.5) * width * 0.72,
      z: z + (random() - 0.5) * depth * 0.72,
      scale: 0.82 + random() * 0.64,
      rotation: random() * Math.PI,
      dead: random() < 0.2,
    })
  }

  const trunkMaterial = materials.wood.clone()
  trunkMaterial.color.setHex(0x211814)
  const foliageMaterial = materials.leaves.clone()
  foliageMaterial.color.setHex(0x152018)
  const deadMaterial = materials.deadLeaves.clone()
  deadMaterial.color.setHex(0x2a2018)

  const trunkGeometry = new THREE.CylinderGeometry(0.24, 0.42, 8.4, 6)
  const lowerGeometry = new THREE.ConeGeometry(2.45, 4.4, 7)
  const middleGeometry = new THREE.ConeGeometry(2.0, 4.0, 7)
  const crownGeometry = new THREE.ConeGeometry(1.45, 3.5, 7)
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount)
  const lowerLiving = new THREE.InstancedMesh(lowerGeometry, foliageMaterial, treeCount)
  const middleLiving = new THREE.InstancedMesh(middleGeometry, foliageMaterial, treeCount)
  const crownLiving = new THREE.InstancedMesh(crownGeometry, foliageMaterial, treeCount)
  const lowerDead = new THREE.InstancedMesh(lowerGeometry, deadMaterial, treeCount)
  const middleDead = new THREE.InstancedMesh(middleGeometry, deadMaterial, treeCount)
  const crownDead = new THREE.InstancedMesh(crownGeometry, deadMaterial, treeCount)
  const dummy = new THREE.Object3D()
  let livingIndex = 0
  let deadIndex = 0

  for (const tree of trees) {
    const ground = terrainHeightAt(tree.x, tree.z)
    dummy.position.set(tree.x, ground + 4.2 * tree.scale, tree.z)
    dummy.rotation.set(0, tree.rotation, (random() - 0.5) * 0.035)
    dummy.scale.set(tree.scale, tree.scale, tree.scale)
    dummy.updateMatrix()
    trunks.setMatrixAt(livingIndex + deadIndex, dummy.matrix)

    const targetLower = tree.dead ? lowerDead : lowerLiving
    const targetMiddle = tree.dead ? middleDead : middleLiving
    const targetCrown = tree.dead ? crownDead : crownLiving
    const targetIndex = tree.dead ? deadIndex : livingIndex

    dummy.position.y = ground + 6.4 * tree.scale
    dummy.scale.set(tree.scale, tree.scale, tree.scale)
    dummy.updateMatrix()
    targetLower.setMatrixAt(targetIndex, dummy.matrix)

    dummy.position.y = ground + 8.7 * tree.scale
    dummy.scale.set(tree.scale * 0.94, tree.scale * 0.94, tree.scale * 0.94)
    dummy.updateMatrix()
    targetMiddle.setMatrixAt(targetIndex, dummy.matrix)

    dummy.position.y = ground + 10.8 * tree.scale
    dummy.scale.set(tree.scale * 0.9, tree.scale * 0.9, tree.scale * 0.9)
    dummy.updateMatrix()
    targetCrown.setMatrixAt(targetIndex, dummy.matrix)

    if (tree.dead) deadIndex += 1
    else livingIndex += 1
  }

  trunks.count = treeCount
  lowerLiving.count = livingIndex
  middleLiving.count = livingIndex
  crownLiving.count = livingIndex
  lowerDead.count = deadIndex
  middleDead.count = deadIndex
  crownDead.count = deadIndex
  for (const mesh of [trunks, lowerLiving, middleLiving, crownLiving, lowerDead, middleDead, crownDead]) {
    mesh.instanceMatrix.needsUpdate = true
    context.scene.add(mesh)
  }

  // Cheap interior cluster billboards create the apparent miles of forest behind
  // the real roadside trees. They sit only inside the footprint, never form a wall,
  // and cross one another so no single viewing angle exposes a flat backdrop.
  const clusterCanvas = document.createElement('canvas')
  clusterCanvas.width = 1024
  clusterCanvas.height = 512
  const draw = clusterCanvas.getContext('2d')!
  draw.clearRect(0, 0, 1024, 512)
  const clusterRandom = seededRandom(81173)

  const drawClusterTree = (treeX: number, baseY: number, height: number, widthPx: number, shade: string): void => {
    draw.fillStyle = shade
    draw.fillRect(treeX - widthPx * 0.055, baseY - height * 0.47, widthPx * 0.11, height * 0.49)
    const tiers = 6
    for (let tier = 0; tier < tiers; tier += 1) {
      const progress = tier / Math.max(1, tiers - 1)
      const tierY = baseY - height + progress * height * 0.78
      const tierWidth = widthPx * (0.28 + progress * 0.72)
      draw.beginPath()
      draw.moveTo(treeX, tierY - height * 0.08)
      draw.lineTo(treeX - tierWidth, tierY + height * 0.13)
      draw.lineTo(treeX - tierWidth * 0.34, tierY + height * 0.1)
      draw.lineTo(treeX + tierWidth * 0.38, tierY + height * 0.08)
      draw.lineTo(treeX + tierWidth, tierY + height * 0.14)
      draw.closePath()
      draw.fill()
    }
  }

  for (let index = 0; index < 22; index += 1) {
    const treeX = index * 48 + (clusterRandom() - 0.5) * 34
    const height = 210 + clusterRandom() * 230
    const baseY = 488 + clusterRandom() * 18
    drawClusterTree(treeX, baseY, height, 36 + clusterRandom() * 45, index % 3 === 0 ? '#1b241c' : '#0e1712')
  }
  const clusterTexture = new THREE.CanvasTexture(clusterCanvas)
  clusterTexture.colorSpace = THREE.SRGBColorSpace
  clusterTexture.minFilter = THREE.LinearMipmapLinearFilter
  clusterTexture.magFilter = THREE.LinearFilter
  clusterTexture.generateMipmaps = true
  const clusterMaterial = new THREE.MeshStandardMaterial({
    map: clusterTexture,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
    depthWrite: true,
  })

  const clusterPanels = [
    { dx: -4, dz: -7, width: 28, height: 18, rotation: 0.05 },
    { dx: 5, dz: 6, width: 30, height: 20, rotation: -0.08 },
    { dx: -7, dz: 5, width: 31, height: 18, rotation: Math.PI / 2 + 0.11 },
    { dx: 7, dz: -4, width: 29, height: 19, rotation: Math.PI / 2 - 0.09 },
    { dx: 0, dz: 0, width: 27, height: 21, rotation: Math.PI / 4 },
  ]
  for (let index = 0; index < clusterPanels.length; index += 1) {
    const panelInfo = clusterPanels[index]
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(panelInfo.width, panelInfo.height), clusterMaterial)
    const px = x + panelInfo.dx
    const pz = z + panelInfo.dz
    panel.position.set(px, terrainHeightAt(px, pz) + panelInfo.height / 2 - 0.25, pz)
    panel.rotation.y = panelInfo.rotation
    if (index % 2 === 1) panel.scale.x = -1
    context.scene.add(panel)
  }

  // The interior floor is dark earth, not a vertical black volume.
  const forestFloorMaterial = new THREE.MeshStandardMaterial({ color: 0x171812, roughness: 1 })
  const forestFloor = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.9, depth * 0.9), forestFloorMaterial)
  forestFloor.rotation.x = -Math.PI / 2
  forestFloor.position.set(x, terrainHeightAt(x, z) + 0.06, z)
  context.scene.add(forestFloor)

  // Only a few deeply buried glow cards remain. They are small, dim, and masked by
  // trunks so the fire reads as something happening within the forest.
  const glowMaterials: Array<{ material: THREE.MeshStandardMaterial; phase: number }> = []
  const glowCanvas = document.createElement('canvas')
  glowCanvas.width = 256
  glowCanvas.height = 256
  const glowDraw = glowCanvas.getContext('2d')!
  glowDraw.clearRect(0, 0, 256, 256)
  const radial = glowDraw.createRadialGradient(128, 190, 4, 128, 190, 88)
  radial.addColorStop(0, 'rgba(255,120,45,0.82)')
  radial.addColorStop(0.34, 'rgba(180,55,20,0.38)')
  radial.addColorStop(0.72, 'rgba(70,20,12,0.1)')
  radial.addColorStop(1, 'rgba(0,0,0,0)')
  glowDraw.fillStyle = radial
  glowDraw.fillRect(0, 0, 256, 256)
  const glowTexture = new THREE.CanvasTexture(glowCanvas)
  glowTexture.colorSpace = THREE.SRGBColorSpace

  const glowSpots = [
    { dx: -6, dz: 2, rotation: 0.3, phase: 0.4 },
    { dx: 5, dz: -5, rotation: -0.6, phase: 2.1 },
    { dx: 3, dz: 7, rotation: 1.2, phase: 4.3 },
  ]
  for (const spot of glowSpots) {
    const glowMaterial = new THREE.MeshStandardMaterial({
      map: glowTexture,
      emissive: 0xff4d20,
      emissiveMap: glowTexture,
      emissiveIntensity: 0.34,
      transparent: true,
      alphaTest: 0.04,
      side: THREE.DoubleSide,
      roughness: 1,
      depthWrite: false,
    })
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 4.2), glowMaterial)
    const px = x + spot.dx
    const pz = z + spot.dz
    glow.position.set(px, terrainHeightAt(px, pz) + 2.0, pz)
    glow.rotation.y = spot.rotation
    glow.renderOrder = 1
    context.scene.add(glow)
    glowMaterials.push({ material: glowMaterial, phase: spot.phase })
  }

  context.addCollider(x, z, width * 0.94, depth * 0.94, 0.8)
  return glowMaterials
}

function cableBetween(`

const next = source.replace(
  /function addImpassableBurningForest\([\s\S]*?\n\}\n\nfunction cableBetween\(/,
  replacement,
)
if (next === source) throw new Error('Could not replace v10 forest shell with v11 hybrid forest')

writeFileSync(sourcePath, next)
console.log('Applied lightweight hybrid impassable forest v11.')
