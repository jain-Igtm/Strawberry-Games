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
write('src/main.ts', main)

let world = read('src/world.ts')
world = world.replace(
  /  const stairGroups: THREE\.Group\[\] = \[\][\s\S]*?\n  const pedestal = createPedestal/,
  '  const pedestal = createPedestal',
)
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

console.log('Integrated inner ranges directly into the playable world and removed the old stair assemblies.')
