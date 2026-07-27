import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const write = (path, content) => writeFileSync(resolve(root, path), content)

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source
  if (!source.includes(search)) throw new Error(`Could not integrate ${label}`)
  return source.replace(search, replacement)
}

const ranges = read('src/inner-ranges.ts')
if (!ranges.includes('export function buildInnerRanges')) {
  throw new Error('The coherent school builder is not exported')
}
if (ranges.includes('WebGLRenderer.prototype')) {
  throw new Error('The inactive renderer prototype hook returned')
}

let main = read('src/main.ts')
main = replaceRequired(
  main,
  "import { createWorld, type Interaction } from './world'",
  "import { buildInnerRanges } from './inner-ranges'\nimport { createWorld, type Interaction } from './world'",
  'school builder import',
)
main = replaceRequired(
  main,
  'const world = createWorld(scene)',
  `const world = createWorld(scene)
const school = buildInnerRanges(scene)
const objectPosition = new THREE.Vector3()
const objectInsideSchool = (object: THREE.Object3D) => {
  object.getWorldPosition(objectPosition)
  return school.containsPosition(objectPosition.x, objectPosition.z)
}
world.colliders.splice(
  0,
  world.colliders.length,
  ...world.colliders.filter((collider) => {
    const x = (collider.minX + collider.maxX) / 2
    const z = (collider.minZ + collider.maxZ) / 2
    return !school.containsPosition(x, z)
  }),
  ...school.colliders,
)
world.interactions.splice(
  0,
  world.interactions.length,
  ...world.interactions.filter((interaction) => !school.containsPosition(interaction.position.x, interaction.position.z)),
  ...school.interactions,
)
world.animated.splice(
  0,
  world.animated.length,
  ...world.animated.filter((animated) => !objectInsideSchool(animated.object)),
  ...school.animated,
)
world.revealables.splice(
  0,
  world.revealables.length,
  ...world.revealables.filter((object) => !objectInsideSchool(object)),
  ...school.revealables,
)
world.openGroundsCache = school.openCache
const baseGetRegion = world.getRegion
world.getRegion = (x, z) => school.getRegion(x, z) ?? baseGetRegion(x, z)`,
  'coherent school world merge',
)
main = main.replace(
  "showToast('The outer grounds', 'The old road ends here. The ruins do not.', 4500)",
  "showToast('The south gatehouse', 'Beyond the arch, the school closes around its oldest court.', 4500)",
)
write('src/main.ts', main)

let world = read('src/world.ts')
world = world.replace(
  /  const stairGroups: THREE\.Group\[\] = \[\][\s\S]*?\n  const pedestal = createPedestal/,
  '  const pedestal = createPedestal',
)
if (world.includes('const stairGroups: THREE.Group[] = []')) {
  throw new Error('The protruding staircase assemblies were not removed')
}
write('src/world.ts', world)

let html = read('index.html')
html = html.replace(
  /      #world \{[\s\S]*?      #lantern-quick \{/,
  `      #world {
        filter: none;
      }

      #lantern-quick {`,
)
html = html.replace(
  /    <script type="module">\s*import '\/src\/inner-ranges\.ts'\s*import '\/src\/main\.ts'\s*<\/script>/,
  '    <script type="module" src="/src/main.ts"></script>',
)
html = html.replace('GRAVENMERE · SOUTH APPROACH', 'GRAVENMERE · GATEHOUSE RANGE')
html = html.replace('THE YEW WALK', 'SOUTH GATEHOUSE')
if (html.includes('mix-blend-mode: screen')) {
  throw new Error('The washed-out screen overlay was not removed')
}
write('index.html', html)

console.log('Built the school from its circulation plan, removed the overlapping grounds, and repaired the grand stair.')
