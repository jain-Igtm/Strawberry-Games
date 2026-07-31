import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
let source = readFileSync(dockTownPath, 'utf8')

const marker = '// DEADWATER_FIXED_UTAH_HORIZON_V24'

if (!source.includes(marker)) {
  const v22Marker = '// DEADWATER_HOODED_GLIDERS_AND_BROAD_RIDGES_V22'
  const cloudMarker = '  // Use one connected, uniformly dark-gray Castle Romeo-style silhouette.'
  const horizonStart = source.indexOf(v22Marker)
  const cloudStart = source.indexOf(cloudMarker, horizonStart)

  if (horizonStart < 0 || cloudStart < 0) {
    throw new Error('Could not locate the v22 horizon and plume sections')
  }

  const horizon = String.raw`// DEADWATER_HOODED_GLIDERS_AND_BROAD_RIDGES_V22
// DEADWATER_FIXED_UTAH_HORIZON_V24
  // The previous Sprite billboards rotated to face the camera, making the whole
  // horizon swing forward whenever the player turned. This is one fixed world-
  // space texture plane behind the smoke. The plane only carries the texture;
  // every visible landform is painted into the transparent canvas.
  const makeUtahHorizonTexture = (seed: number): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 512
    const draw = canvas.getContext('2d')!
    draw.clearRect(0, 0, canvas.width, canvas.height)
    const random = seededRandom(seed)

    const drawFormation = (
      centerX: number,
      width: number,
      height: number,
      baseY: number,
      color: string,
      phase: number,
    ): void => {
      const left = centerX - width / 2
      const right = centerX + width / 2
      const foot = width * 0.15
      draw.fillStyle = color
      draw.beginPath()
      draw.moveTo(left - foot, baseY)
      draw.lineTo(left, baseY - height * 0.12)
      const samples = 34
      for (let index = 0; index <= samples; index += 1) {
        const progress = index / samples
        const x = left + progress * width
        // A broad weathered crown rather than a semicircle or perfect bowl.
        const crown = 1 - Math.pow(Math.abs(progress * 2 - 1), 3.4)
        const shelves = Math.sin(progress * Math.PI * 5 + phase) * 0.025
        const roughness = (random() - 0.5) * 0.045
        const y = baseY - height * (0.18 + crown * 0.82 + shelves + roughness)
        draw.lineTo(x, y)
      }
      draw.lineTo(right + foot, baseY)
      draw.closePath()
      draw.fill()
    }

    // Pale distant shelves, then warmer nearer buttes and mesas. Their overlap
    // gives depth while remaining a single inexpensive transparent texture.
    drawFormation(160, 430, 132, 490, '#d3c29c', 0.4)
    drawFormation(520, 520, 158, 495, '#ccb68a', 1.7)
    drawFormation(980, 610, 145, 492, '#d5c49e', 2.8)
    drawFormation(1450, 520, 164, 497, '#c8ae7b', 4.1)
    drawFormation(1870, 410, 136, 491, '#d8c7a2', 5.3)

    drawFormation(280, 390, 202, 510, '#b89462', 0.9)
    drawFormation(720, 470, 226, 512, '#ad8354', 2.1)
    drawFormation(1160, 520, 194, 510, '#bc9563', 3.6)
    drawFormation(1570, 410, 238, 512, '#aa7d4f', 4.7)
    drawFormation(1920, 330, 178, 510, '#c09d6c', 5.8)

    // Horizontal strata and scattered weathering are composited only inside the
    // already painted silhouettes, so the transparent sky remains untouched.
    draw.globalCompositeOperation = 'source-atop'
    draw.globalAlpha = 0.16
    draw.fillStyle = '#74583f'
    for (let y = 258; y < 505; y += 17) {
      draw.fillRect(0, y + (random() - 0.5) * 5, canvas.width, 2 + random() * 3)
    }
    draw.globalAlpha = 0.11
    draw.fillStyle = '#f1dfb6'
    for (let index = 0; index < 260; index += 1) {
      draw.fillRect(
        random() * canvas.width,
        238 + random() * 260,
        3 + random() * 18,
        1 + random() * 4,
      )
    }
    draw.globalCompositeOperation = 'source-over'
    draw.globalAlpha = 1

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
    return texture
  }

  const utahMaterial = new THREE.MeshBasicMaterial({
    map: makeUtahHorizonTexture(5317),
    transparent: true,
    alphaTest: 0.025,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: false,
  })
  const utahHorizon = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 108),
    utahMaterial,
  )
  utahHorizon.position.set(
    FALLOUT_HILLS.x + 65,
    43,
    FALLOUT_HILLS.cloudZ + 40,
  )
  utahHorizon.rotation.y = 0
  utahHorizon.renderOrder = -40
  utahHorizon.frustumCulled = true
  context.scene.add(utahHorizon)

`

  source = source.slice(0, horizonStart) + horizon + source.slice(cloudStart)

  // Keep the accepted smoke silhouette, but anchor it in world space as well.
  // A Sprite would continue turning to face the player and recreate the same
  // sideways-horizon illusion even after the mesas were fixed.
  const spriteMaterial = '  const cloudMaterial = new THREE.SpriteMaterial({'
  const meshMaterial = '  const cloudMaterial = new THREE.MeshBasicMaterial({'
  if (!source.includes(spriteMaterial)) {
    throw new Error('Could not locate the v22 plume sprite material')
  }
  source = source.replace(spriteMaterial, meshMaterial)

  const spriteCreation = '  const cloud = new THREE.Sprite(cloudMaterial)\n'
  const meshCreation =
    '  cloudMaterial.side = THREE.DoubleSide\n' +
    '  const cloud = new THREE.Mesh(new THREE.PlaneGeometry(178, 142), cloudMaterial)\n'
  if (!source.includes(spriteCreation)) {
    throw new Error('Could not locate the v22 plume sprite')
  }
  source = source.replace(spriteCreation, meshCreation)
  source = source.replace('  cloud.scale.set(178, 142, 1)\n', '  cloud.rotation.y = 0\n')

  writeFileSync(dockTownPath, source)
  console.log('Anchored the fallout horizon and added fixed Utah-style texture formations.')
} else {
  console.log('The fixed Utah horizon is already applied.')
}
