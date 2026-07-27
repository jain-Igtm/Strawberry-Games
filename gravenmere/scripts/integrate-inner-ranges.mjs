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

let ranges = read('src/inner-ranges.ts')
if (!ranges.includes('export function buildInnerRanges')) {
  throw new Error('The coherent school builder is not exported')
}
if (ranges.includes('WebGLRenderer.prototype')) {
  throw new Error('The inactive renderer prototype hook returned')
}

ranges = replaceRequired(
  ranges,
  "import type { RectCollider } from './math'",
  "import type { RectCollider } from './math'\nimport { flatSurface, rampSurface, type FloorSurface } from './vertical'",
  'vertical surface imports',
)
ranges = replaceRequired(
  ranges,
  '  colliders: RectCollider[]\n  interactions: Interaction[]',
  '  colliders: RectCollider[]\n  surfaces: FloorSurface[]\n  interactions: Interaction[]',
  'school surfaces interface',
)
ranges = replaceRequired(
  ranges,
  "function openings(space: SchoolSpace, side: Side): Opening[] {\n  return schoolPlan.connections.flatMap((connection) => {",
  "function openings(space: SchoolSpace, side: Side): Opening[] {\n  if (space.id === 'north-academic-spine' && side === 'north') {\n    return [{ center: space.x, width: 7 }]\n  }\n  return schoolPlan.connections.flatMap((connection) => {",
  'inner-keep threshold opening',
)
ranges = replaceRequired(
  ranges,
  'const spaces = new Map<string, SchoolSpace>(schoolPlan.spaces.map((space) => [space.id, space] as const))',
  `const spaces = new Map<string, SchoolSpace>(
    schoolPlan.spaces.map((space) => {
      const renderedSpace =
        space.id === 'north-academic-spine' ? { ...space, z: 18.5, depth: 5 } : space
      return [renderedSpace.id, renderedSpace] as const
    }),
  )`,
  'short north threshold',
)
ranges = replaceRequired(
  ranges,
  '  const revealables: THREE.Object3D[] = []\n  const spaces =',
  '  const revealables: THREE.Object3D[] = []\n  const surfaces: FloorSurface[] = []\n  const spaces =',
  'school surface collection',
)
ranges = replaceRequired(
  ranges,
  'for (const space of schoolPlan.spaces) {',
  'for (const space of spaces.values()) {',
  'rendered space loop',
)
ranges = replaceRequired(
  ranges,
  'const regions = schoolPlan.spaces.map(region)',
  'const regions = [...spaces.values()].map(region)',
  'rendered region bounds',
)
ranges = ranges.replace('for (const z of [-1, 5, 11, 17]) {', 'for (const z of [17.2, 19.2]) {')
ranges = ranges.replace(
  "'The first mark faces water held inside the western court.', -48, 94, m.blueGlow)",
  "'The first mark faces water held inside the western court.', -57, 94, m.blueGlow)",
)
ranges = ranges.replace(
  "'The third mark stands beneath the tree whose branches avoid the lanterns.', 48, 94, m.tealGlow)",
  "'The third mark stands beneath the tree whose branches avoid the lanterns.', 57, 94, m.tealGlow)",
)

ranges = replaceRequired(
  ranges,
  `  box(scene, m.dark, 8.1, 0.4, 2.1, x, 3.55, z - 2.85)
  box(scene, m.slate, 8.1, 0.32, 2.1, x, 3.88, z - 2.85)
  for (const supportX of [x - 4.1, x, x + 4.1]) column(scene, list, m.dark, supportX, z - 2.85, 3.5, 0.34)
  collider(list, firstX, z + 0.25, 3.5, 6.8)
  collider(list, secondX, z + 0.25, 3.5, 6.8)`,
  `  box(scene, m.dark, 8.1, 0.4, 2.1, x, 3.55, z - 2.85)
  box(scene, m.slate, 8.1, 0.32, 2.1, x, 3.88, z - 2.85)
  box(scene, m.dark, 8.1, 0.4, 2.5, x, 6.85, z + 3.05)
  box(scene, m.slate, 8.1, 0.32, 2.5, x, 7.18, z + 3.05)
  for (const supportX of [x - 4.1, x, x + 4.1]) column(scene, list, m.dark, supportX, z - 2.85, 3.5, 0.34)`,
  'walkable stair tower platforms',
)
ranges = ranges.replace(
  `  collider(list, -6.1, -50.7, 4.5, 7.8)
  collider(list, 6.1, -43.3, 4.5, 7.8)
`,
  '',
)
ranges = replaceRequired(
  ranges,
  '  cloister(scene, colliders, m, spaces)',
  `  for (const space of spaces.values()) {
    surfaces.push(flatSurface(space.x, space.z, space.width, space.depth, 0, 1))
  }
  for (const [id, mirror] of [['west-stair-tower', 1], ['east-stair-tower', -1]] as const) {
    const stair = spaces.get(id)!
    const firstX = stair.x - mirror * 2.05
    const secondX = stair.x + mirror * 2.05
    surfaces.push(rampSurface(firstX, stair.z + 0.4, 3.2, 5.6, 0, 3.55, 'z', -1, 25))
    surfaces.push(flatSurface(stair.x, stair.z - 2.85, 8.1, 2.1, 3.88, 26))
    surfaces.push(rampSurface(secondX, stair.z + 0.4, 3.2, 5.6, 3.88, 7.18, 'z', 1, 25))
    surfaces.push(flatSurface(stair.x, stair.z + 3.05, 8.1, 2.5, 7.18, 26))
  }
  surfaces.push(rampSurface(-6.1, -50.75, 4.1, 6.7, 0, 4.25, 'z', 1, 25))
  surfaces.push(rampSurface(6.1, -43.25, 4.1, 6.7, 0, 4.25, 'z', -1, 25))
  surfaces.push(flatSurface(0, -47, 18.2, 3.4, 4.25, 26))

  cloister(scene, colliders, m, spaces)`,
  'walkable school floors and stairs',
)
ranges = replaceRequired(
  ranges,
  'return { colliders, interactions, animated, revealables, containsPosition, getRegion: (x, z) => regions.find((value) => value.contains(x, z)) ?? null, openCache }',
  'return { colliders, surfaces, interactions, animated, revealables, containsPosition, getRegion: (x, z) => regions.find((value) => value.contains(x, z)) ?? null, openCache }',
  'school surfaces return value',
)
write('src/inner-ranges.ts', ranges)

let endless = read('src/endless-world.ts')
endless = endless.replace(
  `) {
  box(group, material, width, 0.38, depth, x, y - 0.19, z)`,
  `) {
  void m
  void colliders
  box(group, material, width, 0.38, depth, x, y - 0.19, z)`,
)
write('src/endless-world.ts', endless)

let main = read('src/main.ts')
main = replaceRequired(
  main,
  "import { adaptivePixelRatio, circleIntersectsRect, clampPitch } from './math'",
  "import { adaptivePixelRatio, circleIntersectsRectAtHeight, clampPitch } from './math'",
  'height-aware collision import',
)
main = replaceRequired(
  main,
  "import { createWorld, type Interaction } from './world'",
  "import { createEndlessWorld } from './endless-world'\nimport { buildInnerRanges } from './inner-ranges'\nimport { flatSurface, sampleFloorHeight } from './vertical'\nimport { createWorld, type Interaction } from './world'",
  'endless world imports',
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
const endless = createEndlessWorld(scene)
const baseSurfaces = [flatSurface(0, -55, 150, 145, 0, -20)]
const floorAt = (x: number, z: number, y: number) =>
  sampleFloorHeight(endless.surfaces, x, z, y) ??
  sampleFloorHeight(school.surfaces, x, z, y) ??
  sampleFloorHeight(baseSurfaces, x, z, y)
const collidesAtHeight = (x: number, z: number, y: number) =>
  world.colliders.some((collider) =>
    circleIntersectsRectAtHeight(x, z, y, PLAYER_HEIGHT, PLAYER_RADIUS, collider),
  ) ||
  endless.colliders.some((collider) =>
    circleIntersectsRectAtHeight(x, z, y, PLAYER_HEIGHT, PLAYER_RADIUS, collider),
  )
const baseGetRegion = world.getRegion
world.getRegion = (x, z) => endless.getRegion(x, z) ?? school.getRegion(x, z) ?? baseGetRegion(x, z)`,
  'school and endless world merge',
)
main = main.replace(
  'position: new THREE.Vector3(save.position.x, PLAYER_HEIGHT, save.position.z),',
  'position: new THREE.Vector3(save.position.x, 0, save.position.z),',
)
main = replaceRequired(
  main,
  `  moving: false,
}`,
  `  moving: false,
}
let verticalVelocity = 0
const lastSafePosition = player.position.clone()
const lastSchoolPosition = player.position.clone()`,
  'vertical player state',
)
main = main.replace(
  'camera.position.copy(player.position)',
  'camera.position.set(player.position.x, PLAYER_HEIGHT + player.position.y, player.position.z)',
)
main = replaceRequired(
  main,
  `function persist(): void {
  save.position = {
    x: Number(player.position.x.toFixed(3)),
    z: Number(player.position.z.toFixed(3)),
    yaw: Number(player.yaw.toFixed(4)),
  }`,
  `function persist(): void {
  const savedPosition = endless.containsPosition(player.position.x, player.position.z)
    ? lastSchoolPosition
    : player.position
  save.position = {
    x: Number(savedPosition.x.toFixed(3)),
    z: Number(savedPosition.z.toFixed(3)),
    yaw: Number(player.yaw.toFixed(4)),
  }`,
  'safe persistence outside streamed realms',
)

if (!main.includes('function collidesForMove')) {
  main = main.replace(
    /function movePlayer\(deltaX: number, deltaZ: number\): void \{[\s\S]*?\n\}\n\nfunction updatePlayer/,
    `function collidesForMove(x: number, z: number): boolean {
  const candidateY = floorAt(x, z, player.position.y) ?? player.position.y
  return collidesAtHeight(x, z, candidateY)
}

function movePlayer(deltaX: number, deltaZ: number): void {
  const nextX = player.position.x + deltaX
  if (!collidesForMove(nextX, player.position.z)) player.position.x = nextX
  const nextZ = player.position.z + deltaZ
  if (!collidesForMove(player.position.x, nextZ)) player.position.z = nextZ
}

function updatePlayer`,
  )
}

main = replaceRequired(
  main,
  `  } else {
    footstepTimer = Math.min(footstepTimer, 0.15)
  }
  const bobAmount = player.moving ? 0.031 : 0
  camera.position.set(
    player.position.x + Math.cos(player.bob * 0.5) * bobAmount * 0.25,
    PLAYER_HEIGHT + Math.sin(player.bob) * bobAmount,
    player.position.z,
  )`,
  `  } else {
    footstepTimer = Math.min(footstepTimer, 0.15)
  }

  const floorY = floorAt(player.position.x, player.position.z, player.position.y)
  if (floorY !== null && player.position.y <= floorY + 0.82 && verticalVelocity <= 0) {
    player.position.y = floorY
    verticalVelocity = 0
    lastSafePosition.copy(player.position)
    if (!endless.containsPosition(player.position.x, player.position.z)) {
      lastSchoolPosition.copy(player.position)
    }
  } else {
    verticalVelocity -= 15.5 * delta
    player.position.y += verticalVelocity * delta
  }
  if (player.position.y < -30) {
    player.position.copy(lastSafePosition)
    verticalVelocity = 0
    showToast('The architecture lets go', 'You wake on the last floor that remembered you.', 3400)
  }

  const bobAmount = player.moving ? 0.031 : 0
  camera.position.set(
    player.position.x + Math.cos(player.bob * 0.5) * bobAmount * 0.25,
    PLAYER_HEIGHT + player.position.y + Math.sin(player.bob) * bobAmount,
    player.position.z,
  )`,
  'vertical movement and camera height',
)
main = replaceRequired(
  main,
  '    updatePlayer(delta)\n    updateRegion()',
  '    updatePlayer(delta)\n    endless.update(player.position, clock.elapsedTime)\n    updateRegion()',
  'endless realm streaming update',
)
main = main.replace(
  "showToast('The outer grounds', 'The old road ends here. The ruins do not.', 4500)",
  "showToast('The south gatehouse', 'Climb the east stair. A doorway above it no longer opens into this world.', 5200)",
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
html = html.replace(
  'Search the ranges and inner ruins. Recover the three ward seals,\n             uncover hidden paths with Revelare, and learn where the observatory points.',
  'Explore the old school, climb into the upper threshold, and cross the endless ranges beyond it.',
)
if (html.includes('mix-blend-mode: screen')) {
  throw new Error('The washed-out screen overlay was not removed')
}
write('index.html', html)

console.log('Enabled climbable stairs and streamed endless atmospheric architecture beyond the east stair threshold.')
