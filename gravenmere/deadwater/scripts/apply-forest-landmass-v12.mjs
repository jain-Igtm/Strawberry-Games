import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve(import.meta.dirname, '../src/districts/dock-town.ts')
let source = readFileSync(sourcePath, 'utf8')
const marker = '// DEADWATER_FOREST_LANDMASS_V12'

if (source.includes(marker)) {
  console.log('Deadwater forest landmass v12 already applied.')
  process.exit(0)
}

const replacement = `function addImpassableBurningForest(
  context: DockTownContext,
  materials: DockTownMaterials,
): Array<{ material: THREE.MeshStandardMaterial; phase: number }> {
  ${marker}
  const { x, z, polygon } = IMPASSABLE_FOREST
  const random = seededRandom(712991)

  const pointInsidePolygon = (px: number, pz: number): boolean => {
    let inside = false
    for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
      const currentPoint = polygon[current]
      const previousPoint = polygon[previous]
      const intersects =
        currentPoint.y > pz !== previousPoint.y > pz &&
        px <
          ((previousPoint.x - currentPoint.x) * (pz - currentPoint.y)) /
            (previousPoint.y - currentPoint.y + Number.EPSILON) +
          currentPoint.x
      if (intersects) inside = !inside
    }
    return inside
  }

  const trees: Array<{ x: number; z: number; scale: number; rotation: number; dead: boolean }> = []

  // Distribute the visible tree wall around the full jagged road-facing perimeter,
  // not around a circle or a rectangle.
  for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
    const start = polygon[edgeIndex]
    const end = polygon[(edgeIndex + 1) % polygon.length]
    const edgeLength = start.distanceTo(end)
    const samples = Math.max(4, Math.ceil(edgeLength / 2.35))
    for (let sample = 0; sample < samples; sample += 1) {
      const progress = (sample + 0.2 + random() * 0.6) / samples
      const px = THREE.MathUtils.lerp(start.x, end.x, progress)
      const pz = THREE.MathUtils.lerp(start.y, end.y, progress)
      const tangentX = end.x - start.x
      const tangentZ = end.y - start.y
      const tangentLength = Math.max(0.001, Math.hypot(tangentX, tangentZ))
      const inwardX = -tangentZ / tangentLength
      const inwardZ = tangentX / tangentLength
      const inwardDistance = 0.7 + random() * 3.2
      trees.push({
        x: px + inwardX * inwardDistance,
        z: pz + inwardZ * inwardDistance,
        scale: 0.88 + random() * 0.58,
        rotation: random() * Math.PI,
        dead: random() < 0.16,
      })
    }
  }

  // A smaller number of genuine interior trees preserves parallax between the
  // perimeter and the cheap deep-forest layers.
  let attempts = 0
  while (trees.length < 138 && attempts < 1200) {
    attempts += 1
    const px = 13 + random() * 58
    const pz = 79 + random() * 57
    if (!pointInsidePolygon(px, pz)) continue
    trees.push({
      x: px,
      z: pz,
      scale: 0.82 + random() * 0.7,
      rotation: random() * Math.PI,
      dead: random() < 0.2,
    })
  }

  const treeCount = trees.length
  const trunkMaterial = materials.wood.clone()
  trunkMaterial.color.setHex(0x241915)
  const foliageMaterial = materials.leaves.clone()
  foliageMaterial.color.setHex(0x16241a)
  const deadMaterial = materials.deadLeaves.clone()
  deadMaterial.color.setHex(0x302219)

  const trunkGeometry = new THREE.CylinderGeometry(0.23, 0.43, 8.6, 6)
  const lowerGeometry = new THREE.ConeGeometry(2.5, 4.5, 7)
  const middleGeometry = new THREE.ConeGeometry(2.04, 4.0, 7)
  const crownGeometry = new THREE.ConeGeometry(1.46, 3.55, 7)
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
  let trunkIndex = 0

  for (const tree of trees) {
    const ground = terrainHeightAt(tree.x, tree.z)
    dummy.position.set(tree.x, ground + 4.3 * tree.scale, tree.z)
    dummy.rotation.set(0, tree.rotation, (random() - 0.5) * 0.038)
    dummy.scale.set(tree.scale, tree.scale, tree.scale)
    dummy.updateMatrix()
    trunks.setMatrixAt(trunkIndex, dummy.matrix)
    trunkIndex += 1

    const targetLower = tree.dead ? lowerDead : lowerLiving
    const targetMiddle = tree.dead ? middleDead : middleLiving
    const targetCrown = tree.dead ? crownDead : crownLiving
    const targetIndex = tree.dead ? deadIndex : livingIndex

    dummy.rotation.set(0, tree.rotation, 0)
    dummy.position.y = ground + 6.5 * tree.scale
    dummy.scale.set(tree.scale, tree.scale, tree.scale)
    dummy.updateMatrix()
    targetLower.setMatrixAt(targetIndex, dummy.matrix)

    dummy.position.y = ground + 8.85 * tree.scale
    dummy.scale.set(tree.scale * 0.94, tree.scale * 0.94, tree.scale * 0.94)
    dummy.updateMatrix()
    targetMiddle.setMatrixAt(targetIndex, dummy.matrix)

    dummy.position.y = ground + 10.95 * tree.scale
    dummy.scale.set(tree.scale * 0.9, tree.scale * 0.9, tree.scale * 0.9)
    dummy.updateMatrix()
    targetCrown.setMatrixAt(targetIndex, dummy.matrix)

    if (tree.dead) deadIndex += 1
    else livingIndex += 1
  }

  trunks.count = trunkIndex
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

  // A transparent cluster texture is used only deep inside the polygon. Several
  // crossed panels at different positions create depth without forming a shell.
  const clusterCanvas = document.createElement('canvas')
  clusterCanvas.width = 1024
  clusterCanvas.height = 512
  const draw = clusterCanvas.getContext('2d')!
  draw.clearRect(0, 0, 1024, 512)
  const clusterRandom = seededRandom(96112)

  const drawClusterTree = (treeX: number, baseY: number, height: number, widthPx: number, shade: string): void => {
    draw.fillStyle = shade
    draw.fillRect(treeX - widthPx * 0.055, baseY - height * 0.48, widthPx * 0.11, height * 0.5)
    for (let tier = 0; tier < 6; tier += 1) {
      const progress = tier / 5
      const tierY = baseY - height + progress * height * 0.79
      const tierWidth = widthPx * (0.28 + progress * 0.72)
      draw.beginPath()
      draw.moveTo(treeX, tierY - height * 0.075)
      draw.lineTo(treeX - tierWidth, tierY + height * 0.13)
      draw.lineTo(treeX - tierWidth * 0.32, tierY + height * 0.1)
      draw.lineTo(treeX + tierWidth * 0.38, tierY + height * 0.08)
      draw.lineTo(treeX + tierWidth, tierY + height * 0.14)
      draw.closePath()
      draw.fill()
    }
  }

  for (let index = 0; index < 24; index += 1) {
    const treeX = index * 44 + (clusterRandom() - 0.5) * 34
    const height = 205 + clusterRandom() * 245
    const baseY = 489 + clusterRandom() * 18
    drawClusterTree(
      treeX,
      baseY,
      height,
      36 + clusterRandom() * 46,
      index % 4 === 0 ? '#1d281f' : index % 3 === 0 ? '#121d16' : '#0b1510',
    )
  }

  const clusterTexture = new THREE.CanvasTexture(clusterCanvas)
  clusterTexture.colorSpace = THREE.SRGBColorSpace
  clusterTexture.minFilter = THREE.LinearMipmapLinearFilter
  clusterTexture.magFilter = THREE.LinearFilter
  clusterTexture.generateMipmaps = true
  const clusterMaterial = new THREE.MeshStandardMaterial({
    map: clusterTexture,
    transparent: true,
    alphaTest: 0.14,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
    depthWrite: true,
  })

  const clusterPanels = [
    { px: 34, pz: 99, width: 31, height: 20, rotation: 0.08 },
    { px: 47, pz: 110, width: 34, height: 22, rotation: -0.16 },
    { px: 31, pz: 119, width: 31, height: 19, rotation: 0.22 },
    { px: 51, pz: 94, width: 30, height: 20, rotation: Math.PI / 2 + 0.12 },
    { px: 27, pz: 106, width: 32, height: 21, rotation: Math.PI / 2 - 0.1 },
    { px: 45, pz: 122, width: 29, height: 20, rotation: Math.PI / 3 },
    { px: 39, pz: 106, width: 28, height: 23, rotation: -Math.PI / 4 },
  ]
  for (let index = 0; index < clusterPanels.length; index += 1) {
    const panelInfo = clusterPanels[index]
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(panelInfo.width, panelInfo.height), clusterMaterial)
    panel.position.set(
      panelInfo.px,
      terrainHeightAt(panelInfo.px, panelInfo.pz) + panelInfo.height / 2 - 0.25,
      panelInfo.pz,
    )
    panel.rotation.y = panelInfo.rotation
    if (index % 2 === 1) panel.scale.x = -1
    context.scene.add(panel)
  }

  // The forest floor follows the jagged authored perimeter rather than exposing a
  // circular or rectangular base.
  const floorShape = new THREE.Shape()
  floorShape.moveTo(polygon[0].x - x, polygon[0].y - z)
  for (let index = 1; index < polygon.length; index += 1) {
    floorShape.lineTo(polygon[index].x - x, polygon[index].y - z)
  }
  floorShape.closePath()
  const forestFloorMaterial = new THREE.MeshStandardMaterial({
    color: 0x191a13,
    roughness: 1,
    side: THREE.DoubleSide,
  })
  const forestFloor = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), forestFloorMaterial)
  forestFloor.rotation.x = Math.PI / 2
  forestFloor.position.set(x, terrainHeightAt(x, z) + 0.055, z)
  context.scene.add(forestFloor)

  // A few small low-intensity glows sit deep behind several tree layers. They are
  // intentionally not tall enough to read as exposed flame walls.
  const glowCanvas = document.createElement('canvas')
  glowCanvas.width = 256
  glowCanvas.height = 256
  const glowDraw = glowCanvas.getContext('2d')!
  glowDraw.clearRect(0, 0, 256, 256)
  const radial = glowDraw.createRadialGradient(128, 196, 3, 128, 196, 76)
  radial.addColorStop(0, 'rgba(255,128,54,0.74)')
  radial.addColorStop(0.35, 'rgba(171,55,23,0.28)')
  radial.addColorStop(0.75, 'rgba(65,20,12,0.07)')
  radial.addColorStop(1, 'rgba(0,0,0,0)')
  glowDraw.fillStyle = radial
  glowDraw.fillRect(0, 0, 256, 256)
  const glowTexture = new THREE.CanvasTexture(glowCanvas)
  glowTexture.colorSpace = THREE.SRGBColorSpace

  const glowMaterials: Array<{ material: THREE.MeshStandardMaterial; phase: number }> = []
  const glowSpots = [
    { px: 32, pz: 104, rotation: 0.32, phase: 0.4 },
    { px: 48, pz: 112, rotation: -0.62, phase: 2.1 },
    { px: 38, pz: 122, rotation: 1.05, phase: 4.3 },
    { px: 51, pz: 97, rotation: 0.74, phase: 5.6 },
  ]
  for (const spot of glowSpots) {
    const glowMaterial = new THREE.MeshStandardMaterial({
      map: glowTexture,
      emissive: 0xff5424,
      emissiveMap: glowTexture,
      emissiveIntensity: 0.2,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      roughness: 1,
      depthWrite: false,
    })
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 3.5), glowMaterial)
    glow.position.set(spot.px, terrainHeightAt(spot.px, spot.pz) + 1.65, spot.pz)
    glow.rotation.y = spot.rotation
    glow.renderOrder = 1
    context.scene.add(glow)
    glowMaterials.push({ material: glowMaterial, phase: spot.phase })
  }

  // Several overlapping collision blocks approximate the irregular polygon and
  // leave the named surrounding roads open.
  context.addCollider(40, 106, 38, 46, 0.8)
  context.addCollider(29, 111, 23, 36, 0.8)
  context.addCollider(55, 104, 20, 31, 0.8)
  context.addCollider(43, 124, 32, 15, 0.8)
  context.addCollider(40, 89, 35, 12, 0.8)

  return glowMaterials
}

function cableBetween(`

const next = source.replace(
  /function addImpassableBurningForest\([\s\S]*?\n\}\n\nfunction cableBetween\(/,
  replacement,
)
if (next === source) throw new Error('Could not replace forest with v12 irregular landmass')

writeFileSync(sourcePath, next)
console.log('Applied large irregular impassable forest landmass v12.')
