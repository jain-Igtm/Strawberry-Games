import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mainPath = resolve(import.meta.dirname, '../src/main.ts')
const terrainPath = resolve(import.meta.dirname, '../src/terrain-v5.ts')
const objectsPath = resolve(import.meta.dirname, '../src/world-objects-v5.ts')
let main = readFileSync(mainPath, 'utf8')
let terrain = readFileSync(terrainPath, 'utf8')
let objects = readFileSync(objectsPath, 'utf8')
const marker = '// DEADWATER_DOCK_TOWN_V8'

function replaceRequired(source, label, search, replacement) {
  const next = source.replace(search, replacement)
  if (next === source) throw new Error(`Could not apply Dock Town v8: ${label}`)
  return next
}

if (main.includes(marker)) {
  console.log('Dock Town v8 already applied.')
  process.exit(0)
}

main = replaceRequired(
  main,
  'version marker',
  '// DEADWATER_RECORDED_AUDIO_V7',
  `// DEADWATER_RECORDED_AUDIO_V7\n${marker}`,
)

main = replaceRequired(
  main,
  'camera-directed vehicle steering',
  `    vehicle.yaw += strafe * vehicle.turnRate * dt * steeringStrength * (vehicle.speed < 0 ? -1 : 1)
    const nextX = vehicle.group.position.x - Math.sin(vehicle.yaw) * vehicle.speed * dt`,
  `    const steeringDirection = vehicle.speed < 0 ? -1 : 1
    const manualTurn =
      strafe * vehicle.turnRate * dt * steeringStrength * steeringDirection
    vehicle.yaw += manualTurn
    state.vehicleLookYaw -= manualTurn

    // The right-side look direction is the desired driving heading. The vehicle
    // follows it smoothly while throttle is applied, while the absolute camera
    // direction remains stable as the chassis turns underneath it.
    if (Math.abs(forward) > 0.035) {
      const perspectiveDelta = Math.atan2(
        Math.sin(state.vehicleLookYaw),
        Math.cos(state.vehicleLookYaw),
      )
      const maximumFollowTurn = vehicle.turnRate * dt * steeringStrength * 1.08
      const perspectiveTurn = THREE.MathUtils.clamp(
        perspectiveDelta,
        -maximumFollowTurn,
        maximumFollowTurn,
      ) * steeringDirection
      vehicle.yaw += perspectiveTurn
      state.vehicleLookYaw -= perspectiveTurn
    }

    const nextX = vehicle.group.position.x - Math.sin(vehicle.yaw) * vehicle.speed * dt`,
)

terrain = replaceRequired(
  terrain,
  'Dock Town terrain clearances',
  `  { x: 45, z: 22, radius: 7 },
]`,
  `  { x: 45, z: 22, radius: 7 },
  // Authored Dock Town footprint and named road exits.
  { x: 61, z: 96, radius: 48 },
  { x: 104, z: 108, radius: 40 },
  { x: 83, z: 61, radius: 37 },
  { x: 23, z: 108, radius: 25 },
]`,
)

terrain = replaceRequired(
  terrain,
  'remove obsolete generated Dock Town road',
  `    [new THREE.Vector2(0, 44), new THREE.Vector2(5, 78), new THREE.Vector2(28, 106), new THREE.Vector2(64, 118)],\n`,
  '',
)

terrain = replaceRequired(
  terrain,
  'move old river outside Dock Town',
  `    new THREE.Vector2(78, 133),
    new THREE.Vector2(64, 102),
    new THREE.Vector2(70, 78),
    new THREE.Vector2(52, 54),
    new THREE.Vector2(58, 28),`,
  `    new THREE.Vector2(149, 132),
    new THREE.Vector2(141, 106),
    new THREE.Vector2(145, 82),
    new THREE.Vector2(137, 55),
    new THREE.Vector2(141, 28),`,
)
terrain = replaceRequired(
  terrain,
  'move obsolete Dock Town bridge',
  '  addBridge(scene, materials, 54, 83, 17, 0.2)',
  '  addBridge(scene, materials, 141, 81, 17, 0.08)',
)

terrain = replaceRequired(
  terrain,
  'Dock Town district label',
  `    if (z > 105 && x > 35) return 'NORTH DOCKS'`,
  `    if (z > 122 && x > 25) return 'NORTH DOCKS'
    if (x > 4 && x < 136 && z > 46 && z <= 122) return 'DOCK TOWN'`,
)

objects = replaceRequired(
  objects,
  'remove generic warehouse from authored district',
  `  addEnterableBuilding(context, 62, 104, 14, 10, 'DOCK WAREHOUSE', 0)\n`,
  '',
)

writeFileSync(mainPath, main)
writeFileSync(terrainPath, terrain)
writeFileSync(objectsPath, objects)
console.log('Applied authored Dock Town v8 and camera-directed vehicle steering.')
