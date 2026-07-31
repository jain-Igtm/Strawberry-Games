import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
const mainPath = resolve(root, 'src/main.ts')

const marker = '// DEADWATER_UNMISTAKABLE_INLAND_DEPTH_V27'
let dockTown = readFileSync(dockTownPath, 'utf8')

if (!dockTown.includes(marker)) {
  const warningAnchor =
    "  const warning = box(16, 2.2, 0.22, signMaterial('ROAD CLOSED · FALLOUT')"
  const warningIndex = dockTown.indexOf(warningAnchor)
  if (warningIndex < 0) {
    throw new Error('Could not locate the fallout warning after the v26 scene pass')
  }

  const replacement = String.raw`  // DEADWATER_UNMISTAKABLE_INLAND_DEPTH_V27
  // The v26 build contained different objects, but preserved nearly the same
  // angular composition. Remove those objects and build a visibly different,
  // genuinely inland north country with the blast far beyond every land layer.
  for (const oldName of [
    'dry-northern-fallout-shelf',
    'far-utah-escarpments',
    'near-utah-cliffs-and-bluffs',
    'distant-blast-behind-utah-horizon',
  ]) {
    const oldObject = context.scene.getObjectByName(oldName)
    if (oldObject) oldObject.removeFromParent()
  }

  const makeNorthCountryGroundTexture = (seed: number): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const draw = canvas.getContext('2d')!
    const random = seededRandom(seed)

    draw.fillStyle = '#49372f'
    draw.fillRect(0, 0, canvas.width, canvas.height)

    // Broad sediment and dusty drainage patterns. This is intentionally close
    // to the island ground palette, not the blue-black water it replaces.
    for (let band = 0; band < 26; band += 1) {
      draw.globalAlpha = 0.025 + (band % 5) * 0.007
      draw.fillStyle = band % 3 === 0 ? '#806253' : '#302f2d'
      const y = 8 + band * 20 + (random() - 0.5) * 13
      draw.fillRect(0, y, canvas.width, 5 + random() * 13)
    }

    draw.globalAlpha = 0.12
    draw.fillStyle = '#a27d65'
    for (let index = 0; index < 280; index += 1) {
      draw.fillRect(
        random() * canvas.width,
        random() * canvas.height,
        2 + random() * 18,
        1 + random() * 4,
      )
    }

    draw.globalAlpha = 0.11
    draw.fillStyle = '#252a2b'
    for (let index = 0; index < 70; index += 1) {
      const x = random() * canvas.width
      const y = random() * canvas.height
      draw.fillRect(x, y, 28 + random() * 96, 2 + random() * 7)
    }
    draw.globalAlpha = 1

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(3.2, 1.75)
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
    return texture
  }

  const northGroundMaterial = new THREE.MeshStandardMaterial({
    map: makeNorthCountryGroundTexture(27181),
    color: 0x8b7467,
    roughness: 1,
    metalness: 0,
    fog: true,
    side: THREE.DoubleSide,
  })
  const northGround = new THREE.Mesh(
    new THREE.PlaneGeometry(920, 250),
    northGroundMaterial,
  )
  northGround.name = 'continuous-dry-north-country-v27'
  northGround.rotation.x = -Math.PI / 2
  northGround.position.set(82, 0.075, 315)
  northGround.renderOrder = -90
  northGround.frustumCulled = true
  context.scene.add(northGround)

  // A narrow overlapping apron removes the visible island/water seam without
  // changing collision or making the distant country traversable.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(920, 34),
    northGroundMaterial,
  )
  apron.name = 'north-country-transition-apron-v27'
  apron.rotation.x = -Math.PI / 2
  apron.position.set(82, 0.082, 205)
  apron.renderOrder = -89
  context.scene.add(apron)

  const makeCliffCountryTexture = (
    seed: number,
    mode: 'far' | 'middle' | 'near',
  ): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 512
    const draw = canvas.getContext('2d')!
    const random = seededRandom(seed)
    draw.clearRect(0, 0, canvas.width, canvas.height)

    const face = mode === 'far' ? '#817b70' : mode === 'middle' ? '#806653' : '#704b3b'
    const alternate = mode === 'far' ? '#918a7b' : mode === 'middle' ? '#92745b' : '#805744'
    const shadow = mode === 'far' ? '#42494b' : mode === 'middle' ? '#363b3d' : '#292e30'
    const baseY = mode === 'far' ? 500 : mode === 'middle' ? 504 : 508
    const heightScale = mode === 'far' ? 0.72 : mode === 'middle' ? 0.9 : 1.08

    const cliff = (
      left: number,
      width: number,
      height: number,
      plateauStart: number,
      plateauEnd: number,
      steps: number[],
      alternateFace = false,
    ): void => {
      const right = left + width
      const top = baseY - height * heightScale
      draw.fillStyle = alternateFace ? alternate : face
      draw.beginPath()
      draw.moveTo(left - width * 0.13, baseY)
      draw.lineTo(left, baseY - height * 0.14)
      draw.lineTo(left + width * 0.08, top + height * 0.25)

      const samples = 46
      for (let index = 0; index <= samples; index += 1) {
        const progress = index / samples
        const x = left + width * (0.08 + progress * 0.84)
        let crown = top
        if (progress < plateauStart) {
          crown += (plateauStart - progress) * height * 0.68
        } else if (progress > plateauEnd) {
          crown += (progress - plateauEnd) * height * 0.72
        }
        const stepIndex = Math.min(
          steps.length - 1,
          Math.floor(progress * steps.length),
        )
        crown += steps[stepIndex] * height * 0.018
        crown += Math.sin(progress * Math.PI * 7 + seed * 0.001) * height * 0.012
        crown += (random() - 0.5) * height * 0.018
        draw.lineTo(x, crown)
      }

      draw.lineTo(right - width * 0.04, top + height * 0.28)
      draw.lineTo(right, baseY - height * 0.12)
      draw.lineTo(right + width * 0.14, baseY)
      draw.closePath()
      draw.fill()

      draw.globalCompositeOperation = 'source-atop'

      // One large directional shadow face, plus narrower erosion shadows.
      draw.globalAlpha = mode === 'far' ? 0.19 : mode === 'middle' ? 0.27 : 0.34
      draw.fillStyle = shadow
      draw.beginPath()
      draw.moveTo(left + width * 0.55, top + height * 0.04)
      draw.lineTo(right + width * 0.14, baseY)
      draw.lineTo(left + width * 0.72, baseY)
      draw.closePath()
      draw.fill()

      draw.globalAlpha = mode === 'far' ? 0.07 : 0.11
      draw.fillStyle = '#c2a67e'
      const strata = mode === 'near' ? 10 : 7
      for (let band = 0; band < strata; band += 1) {
        const y = top + height * (0.25 + band * (0.58 / strata))
        const inset = width * (0.07 + random() * 0.11)
        draw.fillRect(
          left + inset,
          y,
          Math.max(14, width - inset * 2),
          1 + random() * 3,
        )
      }

      draw.globalAlpha = mode === 'near' ? 0.2 : 0.12
      draw.fillStyle = '#252b2d'
      for (let scar = 0; scar < 7; scar += 1) {
        const x = left + width * (0.14 + random() * 0.72)
        draw.fillRect(x, top + height * 0.22, 4 + random() * 15, height * (0.32 + random() * 0.42))
      }

      draw.globalCompositeOperation = 'source-over'
      draw.globalAlpha = 1
    }

    if (mode === 'far') {
      cliff(-80, 520, 220, 0.24, 0.67, [8, 3, 1, 0, 2, 5], false)
      cliff(390, 610, 250, 0.3, 0.7, [5, 1, 0, 2, 1, 6], true)
      cliff(940, 570, 218, 0.2, 0.62, [7, 3, 0, 1, 4, 8], false)
      cliff(1450, 650, 260, 0.28, 0.72, [4, 1, 0, 2, 0, 5], true)
    } else if (mode === 'middle') {
      cliff(-100, 430, 236, 0.19, 0.55, [10, 4, 0, 1, 5, 11], false)
      cliff(300, 500, 280, 0.27, 0.66, [6, 2, 0, 1, 3, 9], true)
      cliff(760, 410, 228, 0.14, 0.52, [11, 5, 1, 0, 6, 12], false)
      cliff(1130, 540, 292, 0.3, 0.69, [5, 1, 0, 2, 1, 8], true)
      cliff(1620, 470, 246, 0.2, 0.58, [9, 3, 0, 1, 5, 10], false)
    } else {
      cliff(-120, 360, 244, 0.18, 0.51, [12, 5, 1, 0, 7, 13], false)
      cliff(215, 405, 318, 0.31, 0.68, [5, 1, 0, 2, 1, 8], true)
      cliff(590, 330, 230, 0.12, 0.46, [14, 7, 2, 0, 8, 15], false)
      cliff(890, 440, 300, 0.26, 0.63, [7, 2, 0, 1, 4, 11], true)
      cliff(1295, 350, 250, 0.16, 0.5, [12, 5, 0, 2, 8, 14], false)
      cliff(1610, 500, 326, 0.32, 0.7, [5, 1, 0, 2, 1, 7], true)
    }

    // Talus and low broken bluffs make each layer meet the land instead of
    // ending as a collection of isolated transparent cutouts.
    draw.fillStyle = mode === 'far' ? '#545759' : mode === 'middle' ? '#4b4039' : '#3e332e'
    draw.beginPath()
    draw.moveTo(0, baseY - 46)
    for (let x = 0; x <= canvas.width; x += 30) {
      const y = baseY - 54 + Math.sin(x * 0.015 + seed) * 12 + (random() - 0.5) * 16
      draw.lineTo(x, y)
    }
    draw.lineTo(canvas.width, canvas.height)
    draw.lineTo(0, canvas.height)
    draw.closePath()
    draw.fill()

    draw.globalCompositeOperation = 'source-atop'
    draw.globalAlpha = mode === 'far' ? 0.26 : mode === 'middle' ? 0.16 : 0.1
    draw.fillStyle = '#596164'
    draw.fillRect(0, 0, canvas.width, canvas.height)

    // Base haze softens the texture into the dry shelf.
    for (let band = 0; band < 15; band += 1) {
      draw.globalAlpha = 0.018 + band * 0.011
      draw.fillStyle = '#42494b'
      draw.fillRect(0, baseY - 68 + band * 5, canvas.width, 8)
    }

    draw.globalCompositeOperation = 'destination-out'
    for (let band = 0; band < 12; band += 1) {
      draw.globalAlpha = 0.025 + band * 0.025
      draw.fillStyle = '#000000'
      draw.fillRect(0, 496 + band, canvas.width, 2)
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

  const addNorthCountryLayer = (
    name: string,
    texture: THREE.Texture,
    width: number,
    height: number,
    x: number,
    y: number,
    z: number,
    opacity: number,
    renderOrder: number,
  ): void => {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: true,
    })
    const layer = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    layer.name = name
    layer.position.set(x, y, z)
    layer.renderOrder = renderOrder
    layer.frustumCulled = true
    context.scene.add(layer)
  }

  // These are separated by much larger world distances than the previous pass.
  // The different silhouettes and vertical scales make the depth change visible.
  addNorthCountryLayer(
    'true-far-utah-escarpment-v27',
    makeCliffCountryTexture(17031, 'far'),
    1080,
    220,
    80,
    92,
    560,
    0.7,
    -92,
  )
  addNorthCountryLayer(
    'true-mid-utah-cliffs-v27',
    makeCliffCountryTexture(17032, 'middle'),
    990,
    175,
    76,
    68,
    450,
    0.86,
    -68,
  )
  addNorthCountryLayer(
    'true-near-utah-bluffs-v27',
    makeCliffCountryTexture(17033, 'near'),
    900,
    142,
    70,
    50,
    342,
    0.97,
    -42,
  )

  // The blast is now genuinely hundreds of world units beyond the bluffs. It
  // is not enlarged by the same distance ratio, which was why v26 looked the
  // same. The landscape layers render over it and hide most of its lower stem.
  const distantBlast = new THREE.Group()
  distantBlast.name = 'true-distant-blast-v27'
  distantBlast.position.set(
    FALLOUT_HILLS.cloudX + 60,
    205,
    FALLOUT_HILLS.cloudZ + 470,
  )

  const distantTexture = makeDistantPlumeTexture(18871)
  const distantGeometry = new THREE.PlaneGeometry(420, 340)
  const distantAngles = [0, Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.75]
  for (let index = 0; index < distantAngles.length; index += 1) {
    const material = new THREE.MeshBasicMaterial({
      map: distantTexture,
      transparent: true,
      opacity: index === 0 ? 0.72 : 0.5,
      alphaTest: 0.03,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: true,
      color: index % 2 === 0 ? 0x687072 : 0x343a3c,
    })
    const layer = new THREE.Mesh(distantGeometry, material)
    layer.rotation.y = distantAngles[index]
    layer.position.y = index % 2 === 0 ? 0 : -3.5
    layer.renderOrder = -132 + index
    distantBlast.add(layer)
  }

  const distantShellMaterial = new THREE.MeshBasicMaterial({
    map: makeDistantPlumeTexture(18872, true),
    transparent: true,
    opacity: 0.16,
    alphaTest: 0.014,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: true,
    color: 0x7a8284,
  })
  const distantShell = new THREE.Mesh(
    new THREE.PlaneGeometry(452, 366),
    distantShellMaterial,
  )
  distantShell.position.set(-7, 4, 0)
  distantShell.renderOrder = -138
  distantBlast.add(distantShell)
  context.scene.add(distantBlast)

`

  dockTown = dockTown.slice(0, warningIndex) + replacement + dockTown.slice(warningIndex)
  writeFileSync(dockTownPath, dockTown)
  console.log('Applied unmistakable dry north country and a truly distant blast.')
} else {
  console.log('The unmistakable inland depth pass is already applied.')
}

let main = readFileSync(mainPath, 'utf8')
const mainMarker = '// DEADWATER_DISTANT_HORIZON_DRAW_DISTANCE_V27'
if (!main.includes(mainMarker)) {
  const oldCamera =
    'const camera = new THREE.PerspectiveCamera(69, innerWidth / innerHeight, 0.06, 440)'
  if (!main.includes(oldCamera)) {
    throw new Error('Could not locate the established perspective camera')
  }
  main = main.replace(
    oldCamera,
    `${mainMarker}\nconst camera = new THREE.PerspectiveCamera(69, innerWidth / innerHeight, 0.06, 900)`,
  )
  writeFileSync(mainPath, main)
  console.log('Extended camera draw distance for the genuinely distant horizon.')
} else {
  console.log('Distant horizon draw distance is already configured.')
}
