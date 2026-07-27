import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

function write(relativePath, content) {
  writeFileSync(resolve(root, relativePath), content)
}

function requireReplacement(source, search, replacement, label) {
  if (source.includes(replacement)) return source
  if (!source.includes(search)) throw new Error(`Could not integrate ${label}`)
  return source.replace(search, replacement)
}

let ranges = read('src/inner-ranges.ts')

ranges = ranges.replace(
  "let built = false\nlet lastSafeX = 0\nlet lastSafeZ = 0\nlet copyHookInstalled = false\n",
  '',
)

ranges = ranges.replace(
  /function intersects\([\s\S]*?\nfunction build\(scene: THREE\.Scene, camera: THREE\.PerspectiveCamera\): void \{/,
  `export function buildInnerRanges(scene: THREE.Scene): {\n  colliders: Array<Collider & { enabled: boolean }>\n  getRegion: (x: number, z: number) => RangeLabel | null\n} {`,
)

ranges = ranges.replace(
  /  installPositionHook\(camera\)\n\}\n\ntype RenderFunction[\s\S]*$/,
  `  return {\n    colliders: colliders.map((collider) => ({ ...collider, enabled: true })),\n    getRegion: (x, z) => labels.find((label) => label.contains(x, z)) ?? null,\n  }\n}\n`,
)

if (!ranges.includes('export function buildInnerRanges')) {
  throw new Error('Inner ranges still use the inactive renderer prototype hook')
}
if (ranges.includes('WebGLRenderer.prototype')) {
  throw new Error('Inactive renderer prototype hook was not removed')
}

ranges = ranges.replace(
  /(function addLantern\([\s\S]*?\n  )color: number,/,
  '$1_color: number,',
)
ranges = ranges.replace(
  /\n  const light = new THREE\.PointLight\(color, 10, 22, 1\.68\)\n  light\.position\.set\(x, y - 0\.38, z\)\n  scene\.add\(light\)/,
  '\n  // The emissive cage keeps the glow; room lights provide the illumination.',
)
if (ranges.includes('new THREE.PointLight(color, 10, 22, 1.68)')) {
  throw new Error('Decorative lantern point lights were not removed')
}

const optimizationHelper = `
function optimizeStaticRangeGeometry(root: THREE.Group): void {
  root.updateMatrixWorld(true)
  const buckets = new Map<
    string,
    {
      geometry: THREE.BoxGeometry
      material: THREE.Material
      meshes: THREE.Mesh<THREE.BoxGeometry, THREE.Material>[]
    }
  >()

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    if (!(object.geometry instanceof THREE.BoxGeometry)) return
    if (Array.isArray(object.material) || object.material.transparent) return
    const worldX = object.matrixWorld.elements[12]
    const worldZ = object.matrixWorld.elements[14]
    const cellX = Math.floor(worldX / 32)
    const cellZ = Math.floor(worldZ / 32)
    const key = \`${'${object.geometry.uuid}'}:${'${object.material.uuid}'}:${'${cellX}'}:${'${cellZ}'}\`
    const existing = buckets.get(key)
    const mesh = object as THREE.Mesh<THREE.BoxGeometry, THREE.Material>
    if (existing) existing.meshes.push(mesh)
    else buckets.set(key, { geometry: object.geometry, material: object.material, meshes: [mesh] })
  })

  for (const bucket of buckets.values()) {
    if (bucket.meshes.length < 4) continue
    const batch = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.meshes.length)
    for (let index = 0; index < bucket.meshes.length; index += 1) {
      const mesh = bucket.meshes[index]
      batch.setMatrixAt(index, mesh.matrixWorld)
      mesh.parent?.remove(mesh)
    }
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    batch.instanceMatrix.needsUpdate = true
    batch.computeBoundingBox()
    batch.computeBoundingSphere()
    root.add(batch)
  }

  root.updateMatrixWorld(true)
  root.traverse((object) => {
    if (object === root) return
    object.updateMatrix()
    object.matrixAutoUpdate = false
    object.matrixWorldAutoUpdate = false
  })
}
`

if (!ranges.includes('function optimizeStaticRangeGeometry')) {
  const marker = '\nconst labels: RangeLabel[] = ['
  if (!ranges.includes(marker)) throw new Error('Could not install static geometry optimizer')
  ranges = ranges.replace(marker, `${optimizationHelper}${marker}`)
}

const originalBuildCalls = `  const materials = createMaterials()
  addFixedCrossedStair(scene, materials)
  addFoundersCourt(scene, materials)
  addLongGallery(scene, materials)
  addMoonCloister(scene, materials)
  addSurveyHall(scene, materials)
  addSouthVestibule(scene, materials)
  addWinterGarden(scene, materials)
  addLanternConservatory(scene, materials)
  addSideRanges(scene, materials)
  addConnections(scene, materials)`
const optimizedBuildCalls = `  const materials = createMaterials()
  const rangeRoot = new THREE.Group()
  rangeRoot.name = 'gravenmere-inner-ranges'
  scene.add(rangeRoot)
  const target = rangeRoot as unknown as THREE.Scene
  addFixedCrossedStair(target, materials)
  addFoundersCourt(target, materials)
  addLongGallery(target, materials)
  addMoonCloister(target, materials)
  addSurveyHall(target, materials)
  addSouthVestibule(target, materials)
  addWinterGarden(target, materials)
  addLanternConservatory(target, materials)
  addSideRanges(target, materials)
  addConnections(target, materials)`
ranges = requireReplacement(ranges, originalBuildCalls, optimizedBuildCalls, 'optimized range root')

if (!ranges.includes('optimizeStaticRangeGeometry(rangeRoot)')) {
  const returnMarker = '  return {\n    colliders: colliders.map'
  if (!ranges.includes(returnMarker)) throw new Error('Could not activate static geometry optimizer')
  ranges = ranges.replace(
    returnMarker,
    '  optimizeStaticRangeGeometry(rangeRoot)\n' + returnMarker,
  )
}
write('src/inner-ranges.ts', ranges)

let main = read('src/main.ts')
main = requireReplacement(
  main,
  "import { createWorld, type Interaction } from './world'",
  "import { buildInnerRanges } from './inner-ranges'\nimport { createWorld, type Interaction } from './world'",
  'inner-ranges import',
)
main = requireReplacement(
  main,
  'const world = createWorld(scene)',
  `const world = createWorld(scene)\nconst innerRanges = buildInnerRanges(scene)\nworld.colliders.push(...innerRanges.colliders)\nconst baseGetRegion = world.getRegion\nworld.getRegion = (x, z) => innerRanges.getRegion(x, z) ?? baseGetRegion(x, z)`,
  'inner-ranges world call',
)
main = requireReplacement(
  main,
  'let renderRatio = Math.min(window.devicePixelRatio || 1, 1.35)',
  `let renderRatio = Capacitor.isNativePlatform()\n  ? Math.min(window.devicePixelRatio || 1, 0.9)\n  : Math.min(window.devicePixelRatio || 1, 1.2)`,
  'native render resolution',
)
main = main.replace(
  'if (performanceTimer > 2.5 && frameCount > 30) {',
  'if (performanceTimer > 1.25 && frameCount > 15) {',
)
write('src/main.ts', main)

let world = read('src/world.ts')
world = world.replace(
  /  const stairGroups: THREE\.Group\[\] = \[\][\s\S]*?\n  const pedestal = createPedestal/,
  '  const pedestal = createPedestal',
)
world = world.replace('  const count = 720', '  const count = 360')
if (world.includes('const stairGroups: THREE.Group[] = []')) {
  throw new Error('The original protruding stair assemblies were not removed')
}
write('src/world.ts', world)

let html = read('index.html')
html = html.replace(
  /      #world \{[\s\S]*?      #lantern-quick \{/,
  `      #world {\n        filter: none;\n      }\n\n      #lantern-quick {`,
)
html = html.replace(
  /    <script type="module">\s*import '\/src\/inner-ranges\.ts'\s*import '\/src\/main\.ts'\s*<\/script>/,
  '    <script type="module" src="/src/main.ts"></script>',
)
if (html.includes('mix-blend-mode: screen')) {
  throw new Error('The washed-out screen overlay was not removed')
}
write('index.html', html)

console.log('Integrated and mobile-optimized the expanded school.')
