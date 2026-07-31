import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
let source = readFileSync(dockTownPath, 'utf8')

const marker = '// DEADWATER_HOODED_GLIDERS_AND_BROAD_RIDGES_V22'

if (!source.includes(marker)) {
  const hillsPattern = /  \/\/ DEADWATER_TEXTURED_FALLOUT_RANGE_V21[\s\S]*?(?=  \/\/ Use the dark Castle Romeo smoke as the mask)/
  if (!hillsPattern.test(source)) {
    throw new Error('Could not locate the v21 spike-ridge texture pass')
  }

  source = source.replace(
    hillsPattern,
    `${marker}\n` +
    `  // The fallout boundary is a handful of long, low, irregular ridgelines.\n` +
    `  // No cones, domes, repeated triangular peaks, or traversable hill meshes.\n` +
    `  const makeBroadRidgeTexture = (seed: number): THREE.CanvasTexture => {\n` +
    `    const canvas = document.createElement('canvas')\n` +
    `    canvas.width = 1024\n` +
    `    canvas.height = 256\n` +
    `    const draw = canvas.getContext('2d')!\n` +
    `    draw.clearRect(0, 0, canvas.width, canvas.height)\n` +
    `    const random = seededRandom(seed)\n\n` +
    `    const drawRidge = (\n` +
    `      baseY: number,\n` +
    `      amplitude: number,\n` +
    `      color: string,\n` +
    `      frequency: number,\n` +
    `      phase: number,\n` +
    `    ): void => {\n` +
    `      draw.fillStyle = color\n` +
    `      draw.beginPath()\n` +
    `      draw.moveTo(0, canvas.height)\n` +
    `      draw.lineTo(0, baseY)\n` +
    `      let rollingY = baseY - amplitude * (0.42 + random() * 0.14)\n` +
    `      for (let x = 0; x <= canvas.width; x += 24) {\n` +
    `        const broadWave = Math.sin((x / canvas.width) * Math.PI * 2 * frequency + phase)\n` +
    `        const target =\n` +
    `          baseY -\n` +
    `          amplitude * (0.42 + broadWave * 0.17 + (random() - 0.5) * 0.22)\n` +
    `        rollingY = rollingY * 0.78 + target * 0.22\n` +
    `        draw.lineTo(x, rollingY)\n` +
    `      }\n` +
    `      draw.lineTo(canvas.width, canvas.height)\n` +
    `      draw.closePath()\n` +
    `      draw.fill()\n` +
    `    }\n\n` +
    `    drawRidge(220, 72, '#45494b', 1.35, random() * Math.PI * 2)\n` +
    `    drawRidge(236, 62, '#34383a', 1.8, random() * Math.PI * 2)\n` +
    `    drawRidge(252, 51, '#24282a', 2.1, random() * Math.PI * 2)\n\n` +
    `    // Subtle mottling makes these read as distant wooded land rather than\n` +
    `    // flat vector polygons, without reintroducing a wall of tree triangles.\n` +
    `    draw.globalAlpha = 0.16\n` +
    `    draw.fillStyle = '#85898a'\n` +
    `    for (let index = 0; index < 120; index += 1) {\n` +
    `      draw.fillRect(\n` +
    `        random() * canvas.width,\n` +
    `        154 + random() * 94,\n` +
    `        2 + random() * 7,\n` +
    `        1 + random() * 3,\n` +
    `      )\n` +
    `    }\n` +
    `    draw.globalAlpha = 1\n\n` +
    `    const texture = new THREE.CanvasTexture(canvas)\n` +
    `    texture.colorSpace = THREE.SRGBColorSpace\n` +
    `    texture.minFilter = THREE.LinearMipmapLinearFilter\n` +
    `    texture.magFilter = THREE.LinearFilter\n` +
    `    texture.generateMipmaps = true\n` +
    `    return texture\n` +
    `  }\n\n` +
    `  const ridgePanels = [\n` +
    `    { x: FALLOUT_HILLS.x - 94, z: FALLOUT_HILLS.z + 38, width: 206, height: 31, seed: 4201 },\n` +
    `    { x: FALLOUT_HILLS.x - 48, z: FALLOUT_HILLS.z + 28, width: 218, height: 34, seed: 4202 },\n` +
    `    { x: FALLOUT_HILLS.x, z: FALLOUT_HILLS.z + 22, width: 224, height: 35, seed: 4203 },\n` +
    `    { x: FALLOUT_HILLS.x + 51, z: FALLOUT_HILLS.z + 29, width: 214, height: 33, seed: 4204 },\n` +
    `    { x: FALLOUT_HILLS.x + 98, z: FALLOUT_HILLS.z + 40, width: 202, height: 30, seed: 4205 },\n` +
    `  ]\n` +
    `  for (let index = 0; index < ridgePanels.length; index += 1) {\n` +
    `    const ridge = ridgePanels[index]\n` +
    `    const material = new THREE.SpriteMaterial({\n` +
    `      map: makeBroadRidgeTexture(ridge.seed),\n` +
    `      transparent: true,\n` +
    `      alphaTest: 0.025,\n` +
    `      depthWrite: false,\n` +
    `      color: 0xffffff,\n` +
    `      fog: true,\n` +
    `    })\n` +
    `    const sprite = new THREE.Sprite(material)\n` +
    `    sprite.position.set(ridge.x, ridge.height * 0.5 - 2.1, ridge.z)\n` +
    `    sprite.scale.set(ridge.width, ridge.height, 1)\n` +
    `    sprite.renderOrder = -40 + index\n` +
    `    context.scene.add(sprite)\n` +
    `  }\n\n`,
  )

  const cloudPattern = /  \/\/ Use the dark Castle Romeo smoke as the mask[\s\S]*?  context\.scene\.add\(cloud\)\n/
  if (!cloudPattern.test(source)) {
    throw new Error('Could not locate the v21 Castle Romeo mask')
  }

  source = source.replace(
    cloudPattern,
    `  // The photograph remains bundled as the visual reference, but a direct\n` +
    `  // runtime threshold kept selecting its dark sky. Draw the Castle Romeo\n` +
    `  // silhouette once as connected, uniformly gray smoke with no internal\n` +
    `  // photograph, holes, bright bars, or giant supporting oval.\n` +
    `  void mushroomCloudTexture\n` +
    `  const makeSolidPlumeTexture = (): THREE.CanvasTexture => {\n` +
    `    const canvas = document.createElement('canvas')\n` +
    `    canvas.width = 512\n` +
    `    canvas.height = 512\n` +
    `    const draw = canvas.getContext('2d')!\n` +
    `    draw.clearRect(0, 0, canvas.width, canvas.height)\n` +
    `    draw.fillStyle = '#292d30'\n\n` +
    `    // Thick connected stem and ground-hugging base.\n` +
    `    draw.beginPath()\n` +
    `    draw.moveTo(204, 474)\n` +
    `    draw.lineTo(221, 354)\n` +
    `    draw.lineTo(230, 279)\n` +
    `    draw.lineTo(282, 279)\n` +
    `    draw.lineTo(292, 354)\n` +
    `    draw.lineTo(312, 474)\n` +
    `    draw.lineTo(287, 490)\n` +
    `    draw.lineTo(223, 490)\n` +
    `    draw.closePath()\n` +
    `    draw.fill()\n` +
    `    draw.beginPath()\n` +
    `    draw.moveTo(162, 478)\n` +
    `    draw.lineTo(350, 478)\n` +
    `    draw.lineTo(386, 496)\n` +
    `    draw.lineTo(126, 496)\n` +
    `    draw.closePath()\n` +
    `    draw.fill()\n\n` +
    `    const blob = (x: number, y: number, radius: number): void => {\n` +
    `      draw.beginPath()\n` +
    `      draw.arc(x, y, radius, 0, Math.PI * 2)\n` +
    `      draw.fill()\n` +
    `    }\n\n` +
    `    // Castle-Romeo-style billowing cap: lumpy and wide, but never an oval.\n` +
    `    blob(256, 250, 70)\n` +
    `    blob(194, 247, 65)\n` +
    `    blob(318, 245, 68)\n` +
    `    blob(144, 226, 58)\n` +
    `    blob(368, 224, 60)\n` +
    `    blob(104, 194, 47)\n` +
    `    blob(408, 190, 50)\n` +
    `    blob(154, 171, 65)\n` +
    `    blob(222, 154, 78)\n` +
    `    blob(292, 150, 78)\n` +
    `    blob(360, 166, 66)\n` +
    `    blob(198, 104, 55)\n` +
    `    blob(264, 91, 63)\n` +
    `    blob(326, 108, 56)\n` +
    `    blob(250, 46, 38)\n` +
    `    blob(286, 54, 34)\n\n` +
    `    // Connected vertical billows prevent the neck from becoming a pole.\n` +
    `    blob(236, 308, 31)\n` +
    `    blob(277, 321, 30)\n` +
    `    blob(244, 367, 29)\n` +
    `    blob(275, 399, 31)\n` +
    `    blob(246, 441, 30)\n` +
    `    blob(282, 455, 27)\n\n` +
    `    const texture = new THREE.CanvasTexture(canvas)\n` +
    `    texture.colorSpace = THREE.SRGBColorSpace\n` +
    `    texture.minFilter = THREE.LinearMipmapLinearFilter\n` +
    `    texture.magFilter = THREE.LinearFilter\n` +
    `    texture.generateMipmaps = true\n` +
    `    return texture\n` +
    `  }\n\n` +
    `  const cloudMaterial = new THREE.SpriteMaterial({\n` +
    `    map: makeSolidPlumeTexture(),\n` +
    `    transparent: true,\n` +
    `    alphaTest: 0.08,\n` +
    `    depthWrite: false,\n` +
    `    color: 0xffffff,\n` +
    `    fog: true,\n` +
    `  })\n` +
    `  const cloud = new THREE.Sprite(cloudMaterial)\n` +
    `  cloud.position.set(FALLOUT_HILLS.cloudX, 72, FALLOUT_HILLS.cloudZ)\n` +
    `  cloud.scale.set(178, 142, 1)\n` +
    `  cloud.renderOrder = -20\n` +
    `  cloud.frustumCulled = true\n` +
    `  context.scene.add(cloud)\n`,
  )

  writeFileSync(dockTownPath, source)
  console.log('Applied hooded gliders, broad fallout ridgelines, and a connected solid-gray plume.')
} else {
  console.log('Visual feedback v22 is already applied.')
}
