import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
let source = readFileSync(dockTownPath, 'utf8')

const marker = '// DEADWATER_ATMOSPHERIC_UTAH_AND_VOLUMETRIC_PLUME_V25'

if (!source.includes(marker)) {
  const v24Marker = '// DEADWATER_FIXED_UTAH_HORIZON_V24'
  const cloudMarker = '  // Use one connected, uniformly dark-gray Castle Romeo-style silhouette.'
  const horizonStart = source.indexOf(v24Marker)
  const cloudStart = source.indexOf(cloudMarker, horizonStart)

  if (horizonStart < 0 || cloudStart < 0) {
    throw new Error('Could not locate the fixed Utah horizon and plume sections')
  }

  const horizon = String.raw`// DEADWATER_FIXED_UTAH_HORIZON_V24
// DEADWATER_ATMOSPHERIC_UTAH_AND_VOLUMETRIC_PLUME_V25
  // The formations remain one fixed world-space texture plane. Their shading is
  // baked into the texture so they inherit the town's cool gray haze, rusty
  // ambient cast, and distance falloff instead of reading as bright cardboard.
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
      face: string,
      shadow: string,
      phase: number,
      distance: number,
    ): void => {
      const left = centerX - width / 2
      const right = centerX + width / 2
      const foot = width * 0.15
      draw.fillStyle = face
      draw.beginPath()
      draw.moveTo(left - foot, baseY)
      draw.lineTo(left, baseY - height * 0.11)
      const samples = 42
      for (let index = 0; index <= samples; index += 1) {
        const progress = index / samples
        const x = left + progress * width
        const crown = 1 - Math.pow(Math.abs(progress * 2 - 1), 3.2)
        const shelves = Math.sin(progress * Math.PI * 5 + phase) * 0.018
        const broadErosion = Math.sin(progress * Math.PI * 2.2 + phase * 0.63) * 0.028
        const roughness = (random() - 0.5) * (0.025 + distance * 0.008)
        const y = baseY - height * (0.17 + crown * 0.83 + shelves + broadErosion + roughness)
        draw.lineTo(x, y)
      }
      draw.lineTo(right + foot, baseY)
      draw.closePath()
      draw.fill()

      // A broad shadow mass on the right face makes the rounded crowns feel
      // weathered and directional rather than like uniformly colored bowls.
      draw.globalCompositeOperation = 'source-atop'
      draw.globalAlpha = 0.16 + distance * 0.035
      draw.fillStyle = shadow
      draw.beginPath()
      draw.moveTo(centerX + width * 0.06, baseY - height * 0.94)
      draw.lineTo(right + foot, baseY)
      draw.lineTo(centerX + width * 0.22, baseY)
      draw.closePath()
      draw.fill()

      // Short broken strata belong to each formation instead of running as one
      // continuous wallpaper line across the entire horizon.
      draw.globalAlpha = 0.09 + (1 - distance) * 0.035
      draw.fillStyle = '#d0b98f'
      const strataCount = Math.max(4, Math.round(height / 24))
      for (let band = 0; band < strataCount; band += 1) {
        const y = baseY - height * (0.18 + (band + 1) / (strataCount + 2) * 0.68)
        const inset = width * (0.08 + random() * 0.12)
        draw.fillRect(left + inset, y, Math.max(12, width - inset * 2), 1 + random() * 2)
      }

      // Cool atmospheric contamination increases with distance.
      draw.globalAlpha = 0.12 + distance * 0.16
      draw.fillStyle = '#555d5f'
      draw.fillRect(left - foot, baseY - height * 1.08, width + foot * 2, height * 1.12)
      draw.globalCompositeOperation = 'source-over'
      draw.globalAlpha = 1
    }

    // Distant shelves are smaller, cooler, lower contrast, and partially veiled.
    drawFormation(150, 420, 124, 489, '#9b917d', '#4c5051', 0.4, 1)
    drawFormation(515, 515, 151, 495, '#968975', '#494d4f', 1.7, 0.92)
    drawFormation(970, 605, 140, 492, '#a09580', '#4e5152', 2.8, 0.88)
    drawFormation(1445, 510, 158, 497, '#91826e', '#454a4b', 4.1, 0.94)
    drawFormation(1870, 400, 130, 491, '#a19783', '#505354', 5.3, 1)

    // Nearer formations retain a restrained rusty-beige face, but their bases
    // sink into the same gray-red fallout atmosphere as the streets and sky.
    drawFormation(270, 385, 192, 510, '#8b6d52', '#3c3d3d', 0.9, 0.42)
    drawFormation(710, 465, 216, 512, '#806047', '#37393a', 2.1, 0.3)
    drawFormation(1155, 515, 187, 510, '#8f7053', '#3d3e3f', 3.6, 0.38)
    drawFormation(1570, 405, 226, 512, '#7d5b43', '#343638', 4.7, 0.26)
    drawFormation(1920, 325, 170, 510, '#927458', '#404142', 5.8, 0.46)

    // Large soft highlight and shadow fields unify all layers. Radial gradients
    // are supported by the lightweight startup-test canvas mock.
    draw.globalCompositeOperation = 'source-atop'
    const warmLift = draw.createRadialGradient(520, 205, 20, 650, 265, 1050)
    warmLift.addColorStop(0, 'rgba(198,161,111,0.22)')
    warmLift.addColorStop(0.62, 'rgba(139,109,78,0.07)')
    warmLift.addColorStop(1, 'rgba(70,73,73,0)')
    draw.fillStyle = warmLift
    draw.fillRect(0, 0, canvas.width, canvas.height)

    const coolShade = draw.createRadialGradient(1760, 430, 30, 1640, 390, 1250)
    coolShade.addColorStop(0, 'rgba(31,36,38,0.34)')
    coolShade.addColorStop(0.7, 'rgba(47,52,54,0.1)')
    coolShade.addColorStop(1, 'rgba(47,52,54,0)')
    draw.fillStyle = coolShade
    draw.fillRect(0, 0, canvas.width, canvas.height)

    // Progressive base haze prevents a hard pasted-on horizon edge.
    for (let band = 0; band < 15; band += 1) {
      const progress = band / 14
      draw.globalAlpha = 0.025 + progress * 0.028
      draw.fillStyle = '#343a3c'
      draw.fillRect(0, 438 + band * 5, canvas.width, 7)
    }

    // Very subtle broken erosion marks; lower contrast than the previous pass.
    draw.globalAlpha = 0.08
    draw.fillStyle = '#b89a72'
    for (let index = 0; index < 190; index += 1) {
      draw.fillRect(
        random() * canvas.width,
        260 + random() * 225,
        3 + random() * 13,
        1 + random() * 3,
      )
    }

    // Feather the carrier plane's bottom and side edges into the atmosphere.
    draw.globalCompositeOperation = 'destination-out'
    for (let band = 0; band < 12; band += 1) {
      const alpha = 0.035 + band * 0.035
      draw.globalAlpha = alpha
      draw.fillStyle = '#000000'
      draw.fillRect(0, 476 + band * 3, canvas.width, 4)
      draw.fillRect(band * 5, 0, 6, canvas.height)
      draw.fillRect(canvas.width - 6 - band * 5, 0, 6, canvas.height)
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
    opacity: 0.9,
    alphaTest: 0.018,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: true,
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

  const newCloudStart = source.indexOf(cloudMarker)
  const cloudEndMarker = '  context.scene.add(cloud)\n'
  const cloudEndStart = source.indexOf(cloudEndMarker, newCloudStart)
  if (newCloudStart < 0 || cloudEndStart < 0) {
    throw new Error('Could not locate the complete fixed plume section')
  }
  const cloudEnd = cloudEndStart + cloudEndMarker.length

  const plume = String.raw`  // A shaded texture plus four intersecting fixed planes gives the cloud actual
  // width from oblique views. Nothing follows the camera and there is no heavy
  // high-poly smoke simulation.
  void mushroomCloudTexture
  const makeVolumetricPlumeTexture = (seed: number): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const draw = canvas.getContext('2d')!
    draw.clearRect(0, 0, canvas.width, canvas.height)
    draw.fillStyle = '#3a3f41'

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

    const random = seededRandom(seed)
    draw.globalCompositeOperation = 'source-atop'

    // Cool highlight across the upper-left billows.
    const lift = draw.createRadialGradient(184, 126, 14, 222, 178, 250)
    lift.addColorStop(0, 'rgba(116,124,127,0.52)')
    lift.addColorStop(0.52, 'rgba(82,90,93,0.22)')
    lift.addColorStop(1, 'rgba(55,61,63,0)')
    draw.fillStyle = lift
    draw.fillRect(0, 0, canvas.width, canvas.height)

    // Dense underside and right-side core.
    const core = draw.createRadialGradient(358, 286, 22, 330, 278, 245)
    core.addColorStop(0, 'rgba(20,24,26,0.58)')
    core.addColorStop(0.66, 'rgba(31,36,38,0.24)')
    core.addColorStop(1, 'rgba(31,36,38,0)')
    draw.fillStyle = core
    draw.fillRect(0, 0, canvas.width, canvas.height)

    // Large soft mottled billows avoid a single flat gray fill.
    for (let index = 0; index < 26; index += 1) {
      const x = 88 + random() * 336
      const y = 54 + random() * 390
      const radius = 22 + random() * 58
      const shade = random() < 0.48 ? 'rgba(122,129,131,0.075)' : 'rgba(14,18,20,0.11)'
      draw.fillStyle = shade
      draw.beginPath()
      draw.arc(x, y, radius, 0, Math.PI * 2)
      draw.fill()
    }

    // Darker lower stem sells thickness and weight near the ground.
    for (let band = 0; band < 10; band += 1) {
      draw.globalAlpha = 0.02 + band * 0.012
      draw.fillStyle = '#111719'
      draw.fillRect(174, 345 + band * 14, 164, 16)
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

  const plumeTexture = makeVolumetricPlumeTexture(8871)
  const plumeGeometry = new THREE.PlaneGeometry(178, 142)
  const cloud = new THREE.Group()
  cloud.name = 'fixed-layered-volumetric-fallout-plume'
  cloud.position.set(FALLOUT_HILLS.cloudX, 72, FALLOUT_HILLS.cloudZ)

  const plumeLayers = [
    { rotation: 0, scale: 1, x: 0, z: 0, color: 0x596063, opacity: 0.64 },
    { rotation: Math.PI / 2, scale: 0.91, x: 0, z: 0, color: 0x343a3d, opacity: 0.52 },
    { rotation: Math.PI / 4, scale: 1.02, x: -1.8, z: 1.5, color: 0x4c5356, opacity: 0.38 },
    { rotation: -Math.PI / 4, scale: 0.97, x: 2.1, z: -1.3, color: 0x2c3235, opacity: 0.4 },
  ]

  for (let index = 0; index < plumeLayers.length; index += 1) {
    const layer = plumeLayers[index]
    const material = new THREE.MeshBasicMaterial({
      map: plumeTexture,
      transparent: true,
      opacity: layer.opacity,
      alphaTest: 0.055,
      depthWrite: false,
      side: THREE.DoubleSide,
      color: layer.color,
      fog: true,
      toneMapped: true,
    })
    const plane = new THREE.Mesh(plumeGeometry, material)
    plane.position.set(layer.x, 0, layer.z)
    plane.rotation.y = layer.rotation
    plane.scale.setScalar(layer.scale)
    plane.renderOrder = -20 + index
    plane.frustumCulled = true
    cloud.add(plane)
  }

  // A slightly larger, faint shell softens the outer cap without restoring the
  // old giant oval or allowing any layer to rotate toward the player.
  const shellMaterial = new THREE.MeshBasicMaterial({
    map: plumeTexture,
    transparent: true,
    opacity: 0.16,
    alphaTest: 0.045,
    depthWrite: false,
    side: THREE.DoubleSide,
    color: 0x747b7d,
    fog: true,
    toneMapped: true,
  })
  const shell = new THREE.Mesh(plumeGeometry, shellMaterial)
  shell.scale.setScalar(1.055)
  shell.position.set(-2.4, 1.3, 2.6)
  shell.rotation.y = 0.12
  shell.renderOrder = -15
  cloud.add(shell)

  context.scene.add(cloud)
`

  source = source.slice(0, newCloudStart) + plume + source.slice(cloudEnd)
  writeFileSync(dockTownPath, source)
  console.log('Blended the Utah formations into the fallout atmosphere and added layered plume depth.')
} else {
  console.log('Atmospheric Utah shading and volumetric plume depth are already applied.')
}
