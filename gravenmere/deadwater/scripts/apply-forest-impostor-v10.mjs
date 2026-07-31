import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve(import.meta.dirname, '../src/districts/dock-town.ts')
let source = readFileSync(sourcePath, 'utf8')
const marker = '// DEADWATER_FOREST_IMPOSTOR_V10'

if (source.includes(marker)) {
  console.log('Deadwater forest impostor v10 already applied.')
  process.exit(0)
}

const replacement = `function addImpassableBurningForest(
  context: DockTownContext,
  materials: DockTownMaterials,
): Array<{ material: THREE.MeshStandardMaterial; phase: number }> {
  ${marker}
  const { x, z, width, depth } = IMPASSABLE_FOREST
  const random = seededRandom(91731)

  // One baked forest texture replaces hundreds of individual trees, smoke balls,
  // shadow volumes and flame meshes. The transparent jagged skyline keeps the
  // shell from reading as a rectangular wall while the opaque lower mass hides
  // the deliberately unbuilt interior.
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const draw = canvas.getContext('2d')!
  draw.clearRect(0, 0, canvas.width, canvas.height)

  const groundGradient = draw.createLinearGradient(0, 205, 0, 512)
  groundGradient.addColorStop(0, 'rgba(12,17,13,0)')
  groundGradient.addColorStop(0.22, 'rgba(10,14,11,0.82)')
  groundGradient.addColorStop(0.56, 'rgba(7,10,8,0.98)')
  groundGradient.addColorStop(1, 'rgba(5,7,6,1)')
  draw.fillStyle = groundGradient
  draw.fillRect(0, 170, 1024, 342)

  // Buried fire is painted into the texture instead of represented by costly
  // transparent geometry. It is strongest low in the forest and mostly hidden
  // by the foreground trunks.
  for (let index = 0; index < 18; index += 1) {
    const glowX = random() * 1024
    const glowY = 315 + random() * 155
    const radius = 34 + random() * 72
    const glow = draw.createRadialGradient(glowX, glowY, 2, glowX, glowY, radius)
    glow.addColorStop(0, 'rgba(255,88,25,0.58)')
    glow.addColorStop(0.3, 'rgba(180,48,18,0.28)')
    glow.addColorStop(0.7, 'rgba(76,22,13,0.11)')
    glow.addColorStop(1, 'rgba(30,12,9,0)')
    draw.fillStyle = glow
    draw.fillRect(glowX - radius, glowY - radius, radius * 2, radius * 2)
  }

  const drawTree = (
    treeX: number,
    baseY: number,
    height: number,
    halfWidth: number,
    colour: string,
    jaggedness: number,
  ): void => {
    draw.fillStyle = colour
    const trunkWidth = Math.max(3, halfWidth * 0.14)
    draw.fillRect(treeX - trunkWidth / 2, baseY - height * 0.52, trunkWidth, height * 0.56)

    draw.beginPath()
    draw.moveTo(treeX, baseY - height)
    const tiers = 7
    for (let tier = 1; tier <= tiers; tier += 1) {
      const progress = tier / tiers
      const y = baseY - height + progress * height * 0.9
      const spread = halfWidth * (0.28 + progress * 0.82)
      const notch = spread * (0.45 + random() * jaggedness)
      draw.lineTo(treeX - spread, y)
      draw.lineTo(treeX - notch, y + height * 0.055)
      draw.lineTo(treeX + notch, y + height * 0.035)
      draw.lineTo(treeX + spread, y + height * 0.082)
    }
    draw.lineTo(treeX + halfWidth * 0.56, baseY)
    draw.lineTo(treeX - halfWidth * 0.56, baseY)
    draw.closePath()
    draw.fill()
  }

  // Distant tree line.
  for (let index = 0; index < 34; index += 1) {
    const treeX = index * 31 + (random() - 0.5) * 24
    const height = 150 + random() * 150
    const baseY = 410 + random() * 60
    drawTree(treeX, baseY, height, 28 + random() * 30, '#182018', 0.3)
  }

  // Tall foreground silhouettes create the immense roadside wall without any
  // repeated cone geometry.
  for (let index = 0; index < 25; index += 1) {
    const treeX = index * 43 + (random() - 0.5) * 35
    const height = 220 + random() * 230
    const baseY = 472 + random() * 34
    drawTree(treeX, baseY, height, 42 + random() * 48, random() < 0.23 ? '#1d1511' : '#0b100d', 0.42)
  }

  // A few almost-black trunks in front stop the internal glow from looking like
  // exposed flames at the roadside.
  draw.fillStyle = 'rgba(5,7,6,0.92)'
  for (let index = 0; index < 42; index += 1) {
    const trunkX = random() * 1024
    const trunkWidth = 5 + random() * 12
    const trunkTop = 238 + random() * 140
    draw.fillRect(trunkX, trunkTop, trunkWidth, 512 - trunkTop)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true

  const glowCanvas = document.createElement('canvas')
  glowCanvas.width = 512
  glowCanvas.height = 256
  const glowDraw = glowCanvas.getContext('2d')!
  glowDraw.fillStyle = '#000000'
  glowDraw.fillRect(0, 0, 512, 256)
  for (let index = 0; index < 14; index += 1) {
    const glowX = random() * 512
    const glowY = 170 + random() * 70
    const radius = 18 + random() * 38
    const glow = glowDraw.createRadialGradient(glowX, glowY, 1, glowX, glowY, radius)
    glow.addColorStop(0, 'rgba(255,245,220,0.9)')
    glow.addColorStop(0.25, 'rgba(255,135,55,0.55)')
    glow.addColorStop(0.72, 'rgba(85,25,12,0.12)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    glowDraw.fillStyle = glow
    glowDraw.fillRect(glowX - radius, glowY - radius, radius * 2, radius * 2)
  }
  const glowTexture = new THREE.CanvasTexture(glowCanvas)
  glowTexture.colorSpace = THREE.SRGBColorSpace
  glowTexture.minFilter = THREE.LinearMipmapLinearFilter
  glowTexture.magFilter = THREE.LinearFilter
  glowTexture.generateMipmaps = true

  const forestMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    emissive: 0xff4b1d,
    emissiveMap: glowTexture,
    emissiveIntensity: 0.52,
    transparent: true,
    alphaTest: 0.075,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
    depthWrite: true,
  })

  const perimeter: THREE.Vector2[] = []
  const panelCount = 10
  for (let index = 0; index < panelCount; index += 1) {
    const angle = (index / panelCount) * Math.PI * 2
    perimeter.push(new THREE.Vector2(
      x + Math.cos(angle) * width * 0.49,
      z + Math.sin(angle) * depth * 0.49,
    ))
  }

  for (let index = 0; index < panelCount; index += 1) {
    const start = perimeter[index]
    const end = perimeter[(index + 1) % panelCount]
    const dx = end.x - start.x
    const dz = end.y - start.y
    const length = Math.hypot(dx, dz) + 1.8
    const panelHeight = 23 + (index % 3) * 1.8
    const midpointX = (start.x + end.x) / 2
    const midpointZ = (start.y + end.y) / 2
    const ground = terrainHeightAt(midpointX, midpointZ)
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(length, panelHeight), forestMaterial)
    panel.position.set(midpointX, ground + panelHeight / 2 - 0.35, midpointZ)
    panel.rotation.y = -Math.atan2(dz, dx)
    if (index % 2 === 1) panel.scale.x = -1
    panel.renderOrder = 2
    context.scene.add(panel)
  }

  // A single cheap canopy cap prevents the hollow shell from being visible from
  // elevated viewpoints. It replaces the former giant shadow spheres.
  const canopyMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a100c,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  const canopy = new THREE.Mesh(new THREE.CircleGeometry(1, 12), canopyMaterial)
  canopy.rotation.x = -Math.PI / 2
  canopy.position.set(x, terrainHeightAt(x, z) + 15.8, z)
  canopy.scale.set(width * 0.48, depth * 0.48, 1)
  context.scene.add(canopy)

  context.addCollider(x, z, width * 0.94, depth * 0.94, 0.8)
  return [{ material: forestMaterial, phase: 1.73 }]
}

function cableBetween(`

const next = source.replace(
  /function addImpassableBurningForest\([\s\S]*?\n\}\n\nfunction cableBetween\(/,
  replacement,
)
if (next === source) throw new Error('Could not replace v9 forest with v10 impostor shell')

writeFileSync(sourcePath, next)
console.log('Applied lightweight textured forest impostor v10.')
