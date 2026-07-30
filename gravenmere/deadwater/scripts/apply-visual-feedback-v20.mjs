import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
let source = readFileSync(dockTownPath, 'utf8')

const marker = '// DEADWATER_TEXTURED_FIRE_AND_SOLID_PLUME_V20'

if (!source.includes(marker)) {
  const firePattern = /type FirePocket = \{[\s\S]*?\n\}\n\nfunction addFireSite\([\s\S]*?\n\}\n\nfunction addFalloutHillsAndCloud/
  if (!firePattern.test(source)) {
    throw new Error('Could not locate the road-fire implementation in dock-town.ts')
  }

  source = source.replace(
    firePattern,
    `${marker}\n` +
    `type FirePocket = {\n` +
    `  flame: THREE.Group\n` +
    `  glow: THREE.PointLight | null\n` +
    `  phase: number\n` +
    `}\n\n` +
    `let roadFireTexture: THREE.CanvasTexture | null = null\n\n` +
    `function getRoadFireTexture(): THREE.CanvasTexture {\n` +
    `  if (roadFireTexture) return roadFireTexture\n` +
    `  const canvas = document.createElement('canvas')\n` +
    `  canvas.width = 128\n` +
    `  canvas.height = 192\n` +
    `  const draw = canvas.getContext('2d')!\n` +
    `  draw.clearRect(0, 0, canvas.width, canvas.height)\n\n` +
    `  const smoke = draw.createRadialGradient(64, 58, 5, 64, 58, 56)\n` +
    `  smoke.addColorStop(0, 'rgba(48,48,48,0.58)')\n` +
    `  smoke.addColorStop(0.58, 'rgba(36,36,36,0.24)')\n` +
    `  smoke.addColorStop(1, 'rgba(20,20,20,0)')\n` +
    `  draw.fillStyle = smoke\n` +
    `  draw.fillRect(5, 0, 118, 112)\n\n` +
    `  draw.fillStyle = 'rgba(128,45,18,0.94)'\n` +
    `  draw.beginPath()\n` +
    `  draw.moveTo(18, 184)\n` +
    `  draw.bezierCurveTo(18, 142, 41, 126, 38, 82)\n` +
    `  draw.bezierCurveTo(60, 105, 53, 58, 70, 34)\n` +
    `  draw.bezierCurveTo(79, 79, 106, 100, 110, 143)\n` +
    `  draw.bezierCurveTo(114, 166, 100, 184, 18, 184)\n` +
    `  draw.closePath()\n` +
    `  draw.fill()\n\n` +
    `  draw.fillStyle = 'rgba(232,94,27,0.96)'\n` +
    `  draw.beginPath()\n` +
    `  draw.moveTo(34, 184)\n` +
    `  draw.bezierCurveTo(31, 151, 51, 135, 52, 96)\n` +
    `  draw.bezierCurveTo(69, 118, 66, 80, 79, 61)\n` +
    `  draw.bezierCurveTo(84, 105, 101, 128, 98, 157)\n` +
    `  draw.bezierCurveTo(96, 177, 84, 184, 34, 184)\n` +
    `  draw.closePath()\n` +
    `  draw.fill()\n\n` +
    `  draw.fillStyle = 'rgba(255,190,74,0.98)'\n` +
    `  draw.beginPath()\n` +
    `  draw.moveTo(49, 184)\n` +
    `  draw.bezierCurveTo(47, 156, 61, 145, 63, 116)\n` +
    `  draw.bezierCurveTo(75, 132, 77, 110, 83, 98)\n` +
    `  draw.bezierCurveTo(91, 132, 90, 164, 81, 184)\n` +
    `  draw.closePath()\n` +
    `  draw.fill()\n\n` +
    `  roadFireTexture = new THREE.CanvasTexture(canvas)\n` +
    `  roadFireTexture.colorSpace = THREE.SRGBColorSpace\n` +
    `  roadFireTexture.minFilter = THREE.LinearMipmapLinearFilter\n` +
    `  roadFireTexture.magFilter = THREE.LinearFilter\n` +
    `  roadFireTexture.generateMipmaps = true\n` +
    `  return roadFireTexture\n` +
    `}\n\n` +
    `function addFireSite(\n` +
    `  context: DockTownContext,\n` +
    `  x: number,\n` +
    `  z: number,\n` +
    `  large: boolean,\n` +
    `  lit: boolean,\n` +
    `): FirePocket {\n` +
    `  const ground = terrainHeightAt(x, z)\n` +
    `  const material = new THREE.MeshBasicMaterial({\n` +
    `    map: getRoadFireTexture(),\n` +
    `    transparent: true,\n` +
    `    alphaTest: 0.08,\n` +
    `    opacity: large ? 0.92 : 0.82,\n` +
    `    side: THREE.DoubleSide,\n` +
    `    depthWrite: false,\n` +
    `    toneMapped: false,\n` +
    `  })\n` +
    `  const width = large ? 3.4 : 2.35\n` +
    `  const height = large ? 4.5 : 3.05\n` +
    `  const flame = new THREE.Group()\n` +
    `  for (const rotation of [0, Math.PI / 2]) {\n` +
    `    const card = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)\n` +
    `    card.rotation.y = rotation\n` +
    `    flame.add(card)\n` +
    `  }\n` +
    `  flame.position.set(x, ground + height * 0.48, z)\n` +
    `  flame.renderOrder = 2\n` +
    `  context.scene.add(flame)\n` +
    `  context.scene.add(box(\n` +
    `    large ? 3.2 : 2.2,\n` +
    `    0.45,\n` +
    `    large ? 2.8 : 1.8,\n` +
    `    context.materials.darkRust,\n` +
    `    x,\n` +
    `    ground + 0.24,\n` +
    `    z,\n` +
    `  ))\n` +
    `  const glow = lit ? new THREE.PointLight(0xff5a28, large ? 6.5 : 3.8, large ? 15 : 10, 2) : null\n` +
    `  if (glow) {\n` +
    `    glow.position.set(x, ground + 1.85, z)\n` +
    `    context.scene.add(glow)\n` +
    `  }\n` +
    `  return { flame, glow, phase: Math.random() * Math.PI * 2 }\n` +
    `}\n\n` +
    `function addFalloutHillsAndCloud`,
  )

  const cloudPattern = /  \/\/ A single static billboard restores[\s\S]*?  context\.scene\.add\(cloud\)\n/
  if (!cloudPattern.test(source)) {
    throw new Error('Could not locate the Castle Romeo plume implementation in dock-town.ts')
  }

  source = source.replace(
    cloudPattern,
    `  // Keep the Castle Romeo silhouette, but render every surviving plume pixel\n` +
    `  // as one solid dark gray. There is no sky-color feathering or tonal blend.\n` +
    `  const cloudGeometry = new THREE.PlaneGeometry(218, 164)\n` +
    `  const smokeMaterial = new THREE.ShaderMaterial({\n` +
    `    uniforms: {\n` +
    `      mushroomMap: { value: mushroomCloudTexture },\n` +
    `    },\n` +
    `    vertexShader: \`\n` +
    `      varying vec2 vPhotoUv;\n` +
    `      varying vec2 vPlaneUv;\n` +
    `      void main() {\n` +
    `        vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);\n` +
    `        center.xy += position.xy;\n` +
    `        gl_Position = projectionMatrix * center;\n` +
    `        vPlaneUv = uv;\n` +
    `        vPhotoUv = vec2(\n` +
    `          mix(0.11, 0.89, uv.x),\n` +
    `          mix(0.23, 0.68, uv.y)\n` +
    `        );\n` +
    `      }\n` +
    `    \`,\n` +
    `    fragmentShader: \`\n` +
    `      uniform sampler2D mushroomMap;\n` +
    `      varying vec2 vPhotoUv;\n` +
    `      varying vec2 vPlaneUv;\n` +
    `      void main() {\n` +
    `        vec3 photo = texture2D(mushroomMap, vPhotoUv).rgb;\n` +
    `        float luminance = dot(photo, vec3(0.2126, 0.7152, 0.0722));\n` +
    `        vec2 capPoint = (vPlaneUv - vec2(0.5, 0.68)) / vec2(0.48, 0.34);\n` +
    `        float capSupport = 1.0 - smoothstep(0.82, 1.0, length(capPoint));\n` +
    `        float stemWidth = mix(0.18, 0.075, smoothstep(0.0, 0.36, vPlaneUv.y));\n` +
    `        float stemSupport =\n` +
    `          (1.0 - smoothstep(stemWidth, stemWidth + 0.07, abs(vPlaneUv.x - 0.5))) *\n` +
    `          smoothstep(0.16, 0.25, vPlaneUv.y) *\n` +
    `          (1.0 - smoothstep(0.37, 0.47, vPlaneUv.y));\n` +
    `        float silhouette = max(capSupport, stemSupport) * smoothstep(0.07, 0.36, luminance);\n` +
    `        if (silhouette < 0.2) discard;\n` +
    `        gl_FragColor = vec4(vec3(0.105), 1.0);\n` +
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
  console.log('Applied textured road fires and the solid dark-gray Castle Romeo plume.')
} else {
  console.log('Visual feedback v20 is already applied.')
}
