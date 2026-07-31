import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
let source = readFileSync(dockTownPath, 'utf8')

const marker = '// DEADWATER_HOODED_GLIDERS_AND_BROAD_RIDGES_V22'

if (!source.includes(marker)) {
  const oldHillMarker = '// DEADWATER_TEXTURED_FALLOUT_RANGE_V21'
  const oldCloudMarker = '  // Use the dark Castle Romeo smoke as the mask'
  const hillStart = source.indexOf(oldHillMarker)
  const cloudStart = source.indexOf(oldCloudMarker, hillStart)
  if (hillStart < 0 || cloudStart < 0) {
    throw new Error('Could not locate the v21 fallout range and cloud sections')
  }

  const hills = String.raw`// DEADWATER_HOODED_GLIDERS_AND_BROAD_RIDGES_V22
  // Long, low, irregular texture ridges replace the repeated triangle wall.
  const makeBroadRidgeTexture = (seed: number): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const draw = canvas.getContext('2d')!
    draw.clearRect(0, 0, canvas.width, canvas.height)
    const random = seededRandom(seed)

    const drawRidge = (
      baseY: number,
      amplitude: number,
      color: string,
      frequency: number,
      phase: number,
    ): void => {
      draw.fillStyle = color
      draw.beginPath()
      draw.moveTo(0, canvas.height)
      draw.lineTo(0, baseY)
      let rollingY = baseY - amplitude * (0.42 + random() * 0.14)
      for (let x = 0; x <= canvas.width; x += 24) {
        const broadWave = Math.sin((x / canvas.width) * Math.PI * 2 * frequency + phase)
        const target =
          baseY - amplitude * (0.42 + broadWave * 0.17 + (random() - 0.5) * 0.22)
        rollingY = rollingY * 0.78 + target * 0.22
        draw.lineTo(x, rollingY)
      }
      draw.lineTo(canvas.width, canvas.height)
      draw.closePath()
      draw.fill()
    }

    drawRidge(220, 72, '#45494b', 1.35, random() * Math.PI * 2)
    drawRidge(236, 62, '#34383a', 1.8, random() * Math.PI * 2)
    drawRidge(252, 51, '#24282a', 2.1, random() * Math.PI * 2)

    draw.globalAlpha = 0.16
    draw.fillStyle = '#85898a'
    for (let index = 0; index < 120; index += 1) {
      draw.fillRect(
        random() * canvas.width,
        154 + random() * 94,
        2 + random() * 7,
        1 + random() * 3,
      )
    }
    draw.globalAlpha = 1

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
    return texture
  }

  const ridgePanels = [
    { x: FALLOUT_HILLS.x - 94, z: FALLOUT_HILLS.z + 38, width: 206, height: 31, seed: 4201 },
    { x: FALLOUT_HILLS.x - 48, z: FALLOUT_HILLS.z + 28, width: 218, height: 34, seed: 4202 },
    { x: FALLOUT_HILLS.x, z: FALLOUT_HILLS.z + 22, width: 224, height: 35, seed: 4203 },
    { x: FALLOUT_HILLS.x + 51, z: FALLOUT_HILLS.z + 29, width: 214, height: 33, seed: 4204 },
    { x: FALLOUT_HILLS.x + 98, z: FALLOUT_HILLS.z + 40, width: 202, height: 30, seed: 4205 },
  ]
  for (let index = 0; index < ridgePanels.length; index += 1) {
    const ridge = ridgePanels[index]
    const material = new THREE.SpriteMaterial({
      map: makeBroadRidgeTexture(ridge.seed),
      transparent: true,
      alphaTest: 0.025,
      depthWrite: false,
      color: 0xffffff,
      fog: true,
    })
    const sprite = new THREE.Sprite(material)
    sprite.position.set(ridge.x, ridge.height * 0.5 - 2.1, ridge.z)
    sprite.scale.set(ridge.width, ridge.height, 1)
    sprite.renderOrder = -40 + index
    context.scene.add(sprite)
  }

`

  source = source.slice(0, hillStart) + hills + source.slice(cloudStart)

  const newCloudStart = source.indexOf(oldCloudMarker)
  const cloudEndMarker = '  context.scene.add(cloud)\n'
  const cloudEndStart = source.indexOf(cloudEndMarker, newCloudStart)
  if (newCloudStart < 0 || cloudEndStart < 0) {
    throw new Error('Could not locate the complete v21 Castle Romeo cloud section')
  }
  const cloudEnd = cloudEndStart + cloudEndMarker.length

  const plume = String.raw`  // Use one connected, uniformly dark-gray Castle Romeo-style silhouette.
  // This removes the photographic ghosting, holes, bright bars, and support oval.
  void mushroomCloudTexture
  const makeSolidPlumeTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const draw = canvas.getContext('2d')!
    draw.clearRect(0, 0, canvas.width, canvas.height)
    draw.fillStyle = '#292d30'

    draw.beginPath()
    draw.moveTo(204, 474)
    draw.lineTo(221, 354)
    draw.lineTo(230, 279)
    draw.lineTo(282, 279)
    draw.lineTo(292, 354)
    draw.lineTo(312, 474)
    draw.lineTo(287, 490)
    draw.lineTo(223, 490)
    draw.closePath()
    draw.fill()

    draw.beginPath()
    draw.moveTo(162, 478)
    draw.lineTo(350, 478)
    draw.lineTo(386, 496)
    draw.lineTo(126, 496)
    draw.closePath()
    draw.fill()

    const blob = (x: number, y: number, radius: number): void => {
      draw.beginPath()
      draw.arc(x, y, radius, 0, Math.PI * 2)
      draw.fill()
    }

    blob(256, 250, 70)
    blob(194, 247, 65)
    blob(318, 245, 68)
    blob(144, 226, 58)
    blob(368, 224, 60)
    blob(104, 194, 47)
    blob(408, 190, 50)
    blob(154, 171, 65)
    blob(222, 154, 78)
    blob(292, 150, 78)
    blob(360, 166, 66)
    blob(198, 104, 55)
    blob(264, 91, 63)
    blob(326, 108, 56)
    blob(250, 46, 38)
    blob(286, 54, 34)
    blob(236, 308, 31)
    blob(277, 321, 30)
    blob(244, 367, 29)
    blob(275, 399, 31)
    blob(246, 441, 30)
    blob(282, 455, 27)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
    return texture
  }

  const cloudMaterial = new THREE.SpriteMaterial({
    map: makeSolidPlumeTexture(),
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    color: 0xffffff,
    fog: true,
  })
  const cloud = new THREE.Sprite(cloudMaterial)
  cloud.position.set(FALLOUT_HILLS.cloudX, 72, FALLOUT_HILLS.cloudZ)
  cloud.scale.set(178, 142, 1)
  cloud.renderOrder = -20
  cloud.frustumCulled = true
  context.scene.add(cloud)
`

  source = source.slice(0, newCloudStart) + plume + source.slice(cloudEnd)
  writeFileSync(dockTownPath, source)
  console.log('Applied hooded gliders, broad fallout ridgelines, and a connected solid-gray plume.')
} else {
  console.log('Visual feedback v22 is already applied.')
}
