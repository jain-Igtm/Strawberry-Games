import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
let source = readFileSync(dockTownPath, 'utf8')

const marker = '// DEADWATER_TEXTURED_FALLOUT_RANGE_V21'

if (!source.includes(marker)) {
  const hillsPattern = /  const hillMaterial = materials\.grass\.clone\(\)[\s\S]*?  \/\/ Keep the Castle Romeo silhouette, but render every surviving plume pixel/
  if (!hillsPattern.test(source)) {
    throw new Error('Could not locate the post-v20 fallout hills and plume marker')
  }

  source = source.replace(
    hillsPattern,
    `${marker}\n` +
    `  // These hills are outside the playable boundary. They are a broad layered\n` +
    `  // texture range rather than a handful of expensive traversable dome meshes.\n` +
    `  const makeHillTexture = (seed: number): THREE.CanvasTexture => {\n` +
    `    const canvas = document.createElement('canvas')\n` +
    `    canvas.width = 1024\n` +
    `    canvas.height = 256\n` +
    `    const draw = canvas.getContext('2d')!\n` +
    `    draw.clearRect(0, 0, canvas.width, canvas.height)\n` +
    `    const random = seededRandom(seed)\n` +
    `    const bands = [\n` +
    `      { base: 224, peak: 72, step: 54, color: '#343638' },\n` +
    `      { base: 238, peak: 96, step: 66, color: '#292c2e' },\n` +
    `      { base: 254, peak: 124, step: 78, color: '#202325' },\n` +
    `    ]\n` +
    `    for (const band of bands) {\n` +
    `      draw.fillStyle = band.color\n` +
    `      draw.beginPath()\n` +
    `      draw.moveTo(0, canvas.height)\n` +
    `      draw.lineTo(0, band.base)\n` +
    `      for (let x = 0; x <= canvas.width + band.step; x += band.step) {\n` +
    `        const shoulder = x + band.step * (0.24 + random() * 0.16)\n` +
    `        const summit = x + band.step * (0.48 + random() * 0.12)\n` +
    `        const descent = x + band.step * (0.74 + random() * 0.14)\n` +
    `        const summitY = band.base - band.peak * (0.42 + random() * 0.58)\n` +
    `        draw.lineTo(shoulder, band.base - band.peak * (0.12 + random() * 0.2))\n` +
    `        draw.lineTo(summit, summitY)\n` +
    `        draw.lineTo(descent, band.base - band.peak * (0.14 + random() * 0.22))\n` +
    `        draw.lineTo(x + band.step, band.base)\n` +
    `      }\n` +
    `      draw.lineTo(canvas.width, canvas.height)\n` +
    `      draw.closePath()\n` +
    `      draw.fill()\n` +
    `    }\n` +
    `    draw.globalAlpha = 0.22\n` +
    `    draw.fillStyle = '#73777a'\n` +
    `    for (let index = 0; index < 150; index += 1) {\n` +
    `      draw.fillRect(random() * canvas.width, 118 + random() * 128, 1 + random() * 4, 1 + random() * 2)\n` +
    `    }\n` +
    `    draw.globalAlpha = 1\n` +
    `    const texture = new THREE.CanvasTexture(canvas)\n` +
    `    texture.colorSpace = THREE.SRGBColorSpace\n` +
    `    texture.minFilter = THREE.LinearMipmapLinearFilter\n` +
    `    texture.magFilter = THREE.LinearFilter\n` +
    `    texture.generateMipmaps = true\n` +
    `    return texture\n` +
    `  }\n\n` +
    `  const hillPanels = [\n` +
    `    { x: FALLOUT_HILLS.x - 88, z: FALLOUT_HILLS.z + 17, width: 118, height: 34, seed: 3101 },\n` +
    `    { x: FALLOUT_HILLS.x - 48, z: FALLOUT_HILLS.z + 29, width: 132, height: 39, seed: 3102 },\n` +
    `    { x: FALLOUT_HILLS.x - 5, z: FALLOUT_HILLS.z + 35, width: 142, height: 43, seed: 3103 },\n` +
    `    { x: FALLOUT_HILLS.x + 42, z: FALLOUT_HILLS.z + 31, width: 128, height: 38, seed: 3104 },\n` +
    `    { x: FALLOUT_HILLS.x + 82, z: FALLOUT_HILLS.z + 19, width: 112, height: 33, seed: 3105 },\n` +
    `    { x: FALLOUT_HILLS.x - 72, z: FALLOUT_HILLS.z + 4, width: 104, height: 28, seed: 3106 },\n` +
    `    { x: FALLOUT_HILLS.x + 13, z: FALLOUT_HILLS.z + 7, width: 126, height: 31, seed: 3107 },\n` +
    `    { x: FALLOUT_HILLS.x + 72, z: FALLOUT_HILLS.z + 2, width: 100, height: 27, seed: 3108 },\n` +
    `  ]\n` +
    `  for (const hill of hillPanels) {\n` +
    `    const material = new THREE.SpriteMaterial({\n` +
    `      map: makeHillTexture(hill.seed),\n` +
    `      transparent: true,\n` +
    `      alphaTest: 0.04,\n` +
    `      depthWrite: true,\n` +
    `      color: 0xffffff,\n` +
    `    })\n` +
    `    const sprite = new THREE.Sprite(material)\n` +
    `    sprite.position.set(hill.x, hill.height * 0.42 - 1.2, hill.z)\n` +
    `    sprite.scale.set(hill.width, hill.height, 1)\n` +
    `    context.scene.add(sprite)\n` +
    `  }\n\n` +
    `  // Keep the Castle Romeo silhouette, but render every surviving plume pixel`,
  )

  const cloudPattern = /  \/\/ Keep the Castle Romeo silhouette, but render every surviving plume pixel[\s\S]*?  context\.scene\.add\(cloud\)\n/
  if (!cloudPattern.test(source)) {
    throw new Error('Could not locate the post-v20 Castle Romeo plume')
  }

  source = source.replace(
    cloudPattern,
    `  // Use the dark Castle Romeo smoke as the mask, lightly dilate it to close\n` +
    `  // tiny photographic gaps, then output one constant neutral dark gray.\n` +
    `  const cloudGeometry = new THREE.PlaneGeometry(218, 164)\n` +
    `  const smokeMaterial = new THREE.ShaderMaterial({\n` +
    `    uniforms: { mushroomMap: { value: mushroomCloudTexture } },\n` +
    `    vertexShader: \`\n` +
    `      varying vec2 vPhotoUv;\n` +
    `      varying vec2 vPlaneUv;\n` +
    `      void main() {\n` +
    `        vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);\n` +
    `        center.xy += position.xy;\n` +
    `        gl_Position = projectionMatrix * center;\n` +
    `        vPlaneUv = uv;\n` +
    `        vPhotoUv = vec2(mix(0.11, 0.89, uv.x), mix(0.23, 0.68, uv.y));\n` +
    `      }\n` +
    `    \`,\n` +
    `    fragmentShader: \`\n` +
    `      uniform sampler2D mushroomMap;\n` +
    `      varying vec2 vPhotoUv;\n` +
    `      varying vec2 vPlaneUv;\n` +
    `      float darknessAt(vec2 point) {\n` +
    `        vec3 photo = texture2D(mushroomMap, point).rgb;\n` +
    `        return 1.0 - dot(photo, vec3(0.2126, 0.7152, 0.0722));\n` +
    `      }\n` +
    `      void main() {\n` +
    `        vec2 px = vec2(0.006, 0.009);\n` +
    `        float darkness = darknessAt(vPhotoUv);\n` +
    `        darkness = max(darkness, darknessAt(vPhotoUv + vec2(px.x, 0.0)));\n` +
    `        darkness = max(darkness, darknessAt(vPhotoUv - vec2(px.x, 0.0)));\n` +
    `        darkness = max(darkness, darknessAt(vPhotoUv + vec2(0.0, px.y)));\n` +
    `        darkness = max(darkness, darknessAt(vPhotoUv - vec2(0.0, px.y)));\n` +
    `        darkness = max(darkness, darknessAt(vPhotoUv + px));\n` +
    `        darkness = max(darkness, darknessAt(vPhotoUv - px));\n` +
    `        darkness = max(darkness, darknessAt(vPhotoUv + vec2(px.x, -px.y)));\n` +
    `        darkness = max(darkness, darknessAt(vPhotoUv + vec2(-px.x, px.y)));\n` +
    `        vec2 capPoint = (vPlaneUv - vec2(0.5, 0.68)) / vec2(0.49, 0.35);\n` +
    `        float capSupport = 1.0 - smoothstep(0.9, 1.0, length(capPoint));\n` +
    `        float stemWidth = mix(0.19, 0.075, smoothstep(0.0, 0.37, vPlaneUv.y));\n` +
    `        float stemSupport =\n` +
    `          (1.0 - smoothstep(stemWidth, stemWidth + 0.055, abs(vPlaneUv.x - 0.5))) *\n` +
    `          smoothstep(0.13, 0.22, vPlaneUv.y) *\n` +
    `          (1.0 - smoothstep(0.39, 0.49, vPlaneUv.y));\n` +
    `        float support = max(capSupport, stemSupport);\n` +
    `        float silhouette = support * smoothstep(0.15, 0.34, darkness);\n` +
    `        if (silhouette < 0.16) discard;\n` +
    `        gl_FragColor = vec4(vec3(0.16), 1.0);\n` +
    `      }\n` +
    `    \`,\n` +
    `    transparent: true,\n` +
    `    depthWrite: false,\n` +
    `    side: THREE.DoubleSide,\n` +
    `    toneMapped: false,\n` +
    `  })\n` +
    `  const cloud = new THREE.Mesh(cloudGeometry, smokeMaterial)\n` +
    `  cloud.position.set(FALLOUT_HILLS.cloudX, 82, FALLOUT_HILLS.cloudZ)\n` +
    `  cloud.frustumCulled = true\n` +
    `  context.scene.add(cloud)\n`,
  )

  writeFileSync(dockTownPath, source)
  console.log('Applied the textured fallout range and corrected solid-gray Castle Romeo mask.')
} else {
  console.log('Visual feedback v21 is already applied.')
}
