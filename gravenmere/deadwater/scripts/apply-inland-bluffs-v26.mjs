import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
let source = readFileSync(dockTownPath, 'utf8')

const marker = '// DEADWATER_INLAND_BLUFFS_AND_DISTANT_BLAST_V26'

if (!source.includes(marker)) {
  const v25Marker = '// DEADWATER_ATMOSPHERIC_UTAH_AND_VOLUMETRIC_PLUME_V25'
  const cloudMarker = '  // A shaded texture plus four intersecting fixed planes gives the cloud actual'
  const horizonStart = source.indexOf(v25Marker)
  const cloudStart = source.indexOf(cloudMarker, horizonStart)

  if (horizonStart < 0 || cloudStart < 0) {
    throw new Error('Could not locate the v25 horizon and plume sections')
  }

  const horizon = String.raw`// DEADWATER_ATMOSPHERIC_UTAH_AND_VOLUMETRIC_PLUME_V25
// DEADWATER_INLAND_BLUFFS_AND_DISTANT_BLAST_V26
  // Replace the exposed northern water with a dry inland shelf. The actual sea
  // may still exist below this lightweight plane for the rest of the map, but
  // from town this side now reads as continuous fallout country rather than an
  // island edge. Its texture shares the road's red-gray cast and fades into fog.
  const makeDryShelfTexture = (seed: number): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const draw = canvas.getContext('2d')!
    const random = seededRandom(seed)
    draw.fillStyle = '#4b3630'
    draw.fillRect(0, 0, canvas.width, canvas.height)

    for (let band = 0; band < 18; band += 1) {
      draw.globalAlpha = 0.025 + band * 0.002
      draw.fillStyle = band % 3 === 0 ? '#7a5547' : '#2e3031'
      draw.fillRect(0, 18 + band * 13 + (random() - 0.5) * 6, canvas.width, 4 + random() * 8)
    }

    draw.globalAlpha = 0.08
    draw.fillStyle = '#9a7560'
    for (let index = 0; index < 170; index += 1) {
      draw.fillRect(
        random() * canvas.width,
        random() * canvas.height,
        2 + random() * 12,
        1 + random() * 3,
      )
    }
    draw.globalAlpha = 1

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(2.5, 1.15)
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
    return texture
  }

  const dryShelfMaterial = new THREE.MeshBasicMaterial({
    map: makeDryShelfTexture(7129),
    color: 0x80706a,
    fog: true,
    toneMapped: true,
    side: THREE.DoubleSide,
  })
  const dryShelf = new THREE.Mesh(
    new THREE.PlaneGeometry(780, 112),
    dryShelfMaterial,
  )
  dryShelf.name = 'dry-northern-fallout-shelf'
  dryShelf.rotation.x = -Math.PI / 2
  dryShelf.position.set(102, 0.035, 246)
  dryShelf.renderOrder = -70
  dryShelf.frustumCulled = true
  context.scene.add(dryShelf)

  const makeFarUtahTexture = (seed: number): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    canvas.width = 1536
    canvas.height = 384
    const draw = canvas.getContext('2d')!
    const random = seededRandom(seed)
    draw.clearRect(0, 0, canvas.width, canvas.height)

    const formation = (
      centerX: number,
      width: number,
      height: number,
      baseY: number,
      face: string,
      shadow: string,
      plateau: number,
      phase: number,
    ): void => {
      const left = centerX - width / 2
      const right = centerX + width / 2
      const shoulder = width * 0.16
      draw.fillStyle = face
      draw.beginPath()
      draw.moveTo(left - shoulder, baseY)
      draw.lineTo(left, baseY - height * 0.17)
      const samples = 38
      for (let index = 0; index <= samples; index += 1) {
        const progress = index / samples
        const x = left + progress * width
        const centered = Math.abs(progress * 2 - 1)
        const rounded = 1 - Math.pow(centered, 3.6)
        const flatCrown = centered < plateau ? 1 : Math.max(0, 1 - (centered - plateau) / (1 - plateau))
        const crown = rounded * 0.42 + flatCrown * 0.58
        const shelves = Math.sin(progress * Math.PI * 4.5 + phase) * 0.018
        const roughness = (random() - 0.5) * 0.03
        draw.lineTo(x, baseY - height * (0.17 + crown * 0.83 + shelves + roughness))
      }
      draw.lineTo(right + shoulder, baseY)
      draw.closePath()
      draw.fill()

      draw.globalCompositeOperation = 'source-atop'
      draw.globalAlpha = 0.23
      draw.fillStyle = shadow
      draw.beginPath()
      draw.moveTo(centerX + width * 0.02, baseY - height * 0.97)
      draw.lineTo(right + shoulder, baseY)
      draw.lineTo(centerX + width * 0.28, baseY)
      draw.closePath()
      draw.fill()

      draw.globalAlpha = 0.1
      draw.fillStyle = '#c0aa87'
      for (let band = 0; band < 7; band += 1) {
        const inset = width * (0.08 + random() * 0.13)
        const y = baseY - height * (0.24 + band * 0.09)
        draw.fillRect(left + inset, y, Math.max(18, width - inset * 2), 1 + random() * 2)
      }
      draw.globalCompositeOperation = 'source-over'
      draw.globalAlpha = 1
    }

    // A broad continuous far country: rounded uplands interrupted by high,
    // weathered Utah escarpments and mesas rather than isolated cardboard hills.
    formation(90, 360, 130, 378, '#8b8274', '#42484a', 0.18, 0.7)
    formation(380, 430, 165, 380, '#8f806d', '#3f4446', 0.36, 1.9)
    formation(720, 470, 142, 377, '#9a8f7b', '#474b4c', 0.22, 3.1)
    formation(1070, 420, 178, 381, '#887662', '#3b4042', 0.42, 4.4)
    formation(1395, 350, 138, 378, '#968978', '#44494a', 0.24, 5.5)

    draw.globalCompositeOperation = 'source-atop'
    const haze = draw.createRadialGradient(780, 315, 35, 760, 300, 880)
    haze.addColorStop(0, 'rgba(71,77,79,0.08)')
    haze.addColorStop(0.7, 'rgba(61,68,70,0.22)')
    haze.addColorStop(1, 'rgba(49,56,58,0.34)')
    draw.fillStyle = haze
    draw.fillRect(0, 0, canvas.width, canvas.height)

    for (let band = 0; band < 12; band += 1) {
      draw.globalAlpha = 0.018 + band * 0.012
      draw.fillStyle = '#4b5051'
      draw.fillRect(0, 325 + band * 5, canvas.width, 8)
    }
    draw.globalCompositeOperation = 'destination-out'
    for (let band = 0; band < 10; band += 1) {
      draw.globalAlpha = 0.03 + band * 0.03
      draw.fillStyle = '#000000'
      draw.fillRect(0, 360 + band * 2, canvas.width, 3)
      draw.fillRect(band * 4, 0, 5, canvas.height)
      draw.fillRect(canvas.width - 5 - band * 4, 0, 5, canvas.height)
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

  const makeNearBluffTexture = (seed: number): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    canvas.width = 1536
    canvas.height = 320
    const draw = canvas.getContext('2d')!
    const random = seededRandom(seed)
    draw.clearRect(0, 0, canvas.width, canvas.height)

    const cliff = (
      left: number,
      width: number,
      topY: number,
      baseY: number,
      face: string,
      shadow: string,
      steps: number[],
    ): void => {
      const right = left + width
      draw.fillStyle = face
      draw.beginPath()
      draw.moveTo(left - width * 0.1, baseY)
      draw.lineTo(left, baseY - 22)
      draw.lineTo(left + width * 0.08, topY + 24)
      for (let index = 0; index < steps.length; index += 1) {
        const x = left + width * (0.12 + index / Math.max(1, steps.length - 1) * 0.76)
        draw.lineTo(x, topY + steps[index])
      }
      draw.lineTo(right - width * 0.05, topY + 20)
      draw.lineTo(right, baseY - 16)
      draw.lineTo(right + width * 0.12, baseY)
      draw.closePath()
      draw.fill()

      draw.globalCompositeOperation = 'source-atop'
      draw.globalAlpha = 0.28
      draw.fillStyle = shadow
      draw.beginPath()
      draw.moveTo(left + width * 0.58, topY + 8)
      draw.lineTo(right + width * 0.12, baseY)
      draw.lineTo(left + width * 0.72, baseY)
      draw.closePath()
      draw.fill()

      draw.globalAlpha = 0.1
      draw.fillStyle = '#b69670'
      for (let band = 0; band < 8; band += 1) {
        draw.fillRect(
          left + width * (0.07 + random() * 0.08),
          topY + 32 + band * ((baseY - topY - 45) / 8),
          width * (0.72 + random() * 0.13),
          1 + random() * 3,
        )
      }
      draw.globalCompositeOperation = 'source-over'
      draw.globalAlpha = 1
    }

    // Larger flat-topped cliffs and lower broken bluffs create the foreground
    // land belt. Gaps remain irregular so it never becomes a single wall.
    cliff(-40, 330, 112, 314, '#765443', '#303436', [12, 3, 0, 5, 2, 9])
    cliff(250, 280, 155, 314, '#84634b', '#343739', [8, 0, 4, 2, 11])
    cliff(500, 380, 98, 314, '#72513f', '#2e3234', [14, 5, 0, 2, 8, 4, 15])
    cliff(860, 250, 168, 314, '#8a674e', '#36393a', [7, 2, 0, 6, 10])
    cliff(1080, 360, 118, 314, '#765540', '#303436', [11, 3, 0, 5, 1, 8])
    cliff(1400, 260, 154, 314, '#86664f', '#34383a', [6, 0, 4, 2, 9])

    // Dark low bluffs and talus merge the vertical faces into the dry shelf.
    draw.fillStyle = '#4b3b35'
    draw.beginPath()
    draw.moveTo(0, 284)
    for (let x = 0; x <= canvas.width; x += 28) {
      const y = 271 + Math.sin(x * 0.019) * 9 + (random() - 0.5) * 11
      draw.lineTo(x, y)
    }
    draw.lineTo(canvas.width, canvas.height)
    draw.lineTo(0, canvas.height)
    draw.closePath()
    draw.fill()

    draw.globalCompositeOperation = 'source-atop'
    draw.globalAlpha = 0.15
    draw.fillStyle = '#252b2d'
    draw.fillRect(0, 250, canvas.width, 70)
    draw.globalCompositeOperation = 'destination-out'
    for (let band = 0; band < 8; band += 1) {
      draw.globalAlpha = 0.04 + band * 0.035
      draw.fillStyle = '#000000'
      draw.fillRect(0, 304 + band * 2, canvas.width, 3)
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

  const addFixedLandscapePlane = (
    name: string,
    texture: THREE.Texture,
    width: number,
    height: number,
    y: number,
    z: number,
    opacity: number,
    renderOrder: number,
  ): void => {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity,
      alphaTest: 0.012,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
      toneMapped: true,
    })
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    plane.name = name
    plane.position.set(78, y, z)
    plane.rotation.y = 0
    plane.renderOrder = renderOrder
    plane.frustumCulled = true
    context.scene.add(plane)
  }

  addFixedLandscapePlane(
    'far-utah-escarpments',
    makeFarUtahTexture(5317),
    790,
    132,
    50,
    FALLOUT_HILLS.cloudZ + 105,
    0.82,
    -52,
  )
  addFixedLandscapePlane(
    'near-utah-cliffs-and-bluffs',
    makeNearBluffTexture(9451),
    780,
    103,
    35,
    FALLOUT_HILLS.cloudZ + 58,
    0.94,
    -31,
  )

`

  source = source.slice(0, horizonStart) + horizon + source.slice(cloudStart)

  const newCloudStart = source.indexOf(cloudMarker)
  const cloudEndMarker = '  context.scene.add(cloud)\n'
  const cloudEndStart = source.indexOf(cloudEndMarker, newCloudStart)
  if (newCloudStart < 0 || cloudEndStart < 0) {
    throw new Error('Could not locate the complete v25 plume section')
  }
  const cloudEnd = cloudEndStart + cloudEndMarker.length

  const plume = String.raw`  // The blast is deliberately far beyond the landforms. Four intersecting
  // planes retain the accepted volume, but the entire mass is rendered before
  // the cliffs so their tops and bluffs hide the lower stem. This makes the
  // cloud read as enormous fallout rising from another horizon, not a prop at
  // the edge of town.
  void mushroomCloudTexture
  const makeDistantPlumeTexture = (seed: number, shell = false): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const draw = canvas.getContext('2d')!
    const random = seededRandom(seed)
    draw.clearRect(0, 0, canvas.width, canvas.height)
    draw.fillStyle = shell ? '#54595a' : '#353a3c'

    draw.beginPath()
    draw.moveTo(198, 496)
    draw.lineTo(216, 355)
    draw.lineTo(226, 278)
    draw.lineTo(286, 278)
    draw.lineTo(298, 355)
    draw.lineTo(320, 496)
    draw.closePath()
    draw.fill()

    const blob = (x: number, y: number, radius: number): void => {
      draw.beginPath()
      draw.arc(x, y, radius, 0, Math.PI * 2)
      draw.fill()
    }

    blob(256, 252, 72)
    blob(190, 244, 65)
    blob(322, 242, 68)
    blob(137, 218, 57)
    blob(375, 216, 60)
    blob(96, 184, 45)
    blob(418, 181, 48)
    blob(150, 158, 64)
    blob(218, 140, 80)
    blob(294, 137, 82)
    blob(365, 154, 68)
    blob(192, 90, 55)
    blob(260, 77, 66)
    blob(328, 94, 57)
    blob(244, 35, 39)
    blob(287, 42, 35)
    blob(236, 312, 33)
    blob(280, 326, 32)
    blob(244, 375, 31)
    blob(278, 417, 33)
    blob(246, 462, 31)

    draw.globalCompositeOperation = 'source-atop'
    const lift = draw.createRadialGradient(178, 116, 16, 220, 176, 255)
    lift.addColorStop(0, shell ? 'rgba(129,136,138,0.34)' : 'rgba(112,120,122,0.48)')
    lift.addColorStop(0.58, 'rgba(77,85,87,0.18)')
    lift.addColorStop(1, 'rgba(55,61,63,0)')
    draw.fillStyle = lift
    draw.fillRect(0, 0, canvas.width, canvas.height)

    const core = draw.createRadialGradient(350, 286, 24, 326, 278, 252)
    core.addColorStop(0, shell ? 'rgba(25,30,31,0.25)' : 'rgba(15,19,21,0.62)')
    core.addColorStop(0.7, 'rgba(27,32,34,0.2)')
    core.addColorStop(1, 'rgba(27,32,34,0)')
    draw.fillStyle = core
    draw.fillRect(0, 0, canvas.width, canvas.height)

    for (let index = 0; index < 30; index += 1) {
      draw.fillStyle = random() < 0.46
        ? 'rgba(125,132,134,0.065)'
        : 'rgba(11,15,17,0.1)'
      draw.beginPath()
      draw.arc(80 + random() * 350, 42 + random() * 420, 20 + random() * 62, 0, Math.PI * 2)
      draw.fill()
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

  const cloud = new THREE.Group()
  cloud.name = 'distant-blast-behind-utah-horizon'
  cloud.position.set(FALLOUT_HILLS.cloudX + 28, 114, FALLOUT_HILLS.cloudZ + 175)
  cloud.scale.setScalar(1.32)

  const plumeTexture = makeDistantPlumeTexture(8871)
  const plumeGeometry = new THREE.PlaneGeometry(236, 190)
  const layerAngles = [0, Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.75]
  for (let index = 0; index < layerAngles.length; index += 1) {
    const material = new THREE.MeshBasicMaterial({
      map: plumeTexture,
      transparent: true,
      opacity: index === 0 ? 0.94 : 0.72,
      alphaTest: 0.035,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
      toneMapped: true,
    })
    const layer = new THREE.Mesh(plumeGeometry, material)
    layer.rotation.y = layerAngles[index]
    layer.position.y = index % 2 === 0 ? 0 : -1.8
    layer.renderOrder = -82 + index
    cloud.add(layer)
  }

  const shellMaterial = new THREE.MeshBasicMaterial({
    map: makeDistantPlumeTexture(8872, true),
    transparent: true,
    opacity: 0.22,
    alphaTest: 0.018,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: true,
  })
  const shell = new THREE.Mesh(new THREE.PlaneGeometry(250, 202), shellMaterial)
  shell.position.set(-4, 2, 0)
  shell.renderOrder = -86
  cloud.add(shell)

  context.scene.add(cloud)
`

  source = source.slice(0, newCloudStart) + plume + source.slice(cloudEnd)
  writeFileSync(dockTownPath, source)
  console.log('Replaced the northern water view with inland bluffs and moved the blast far behind the hills.')
} else {
  console.log('The inland bluff horizon and distant blast are already applied.')
}
