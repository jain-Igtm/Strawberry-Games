import assert from 'node:assert/strict'
import { BAR, buildWorld, HOSPITAL, mapMetadata, PLAYER_START, ROADS, WALL } from '../www/js/map.js'

const world = buildWorld()
const metadata = mapMetadata()

assert.equal(ROADS.length, 10, 'The authored ten-road Dock Town network must be retained')
assert.deepEqual(metadata.hospital, { x: 176, z: 106, width: 76, depth: 46 })
assert.equal(metadata.forestVertices, 12)
assert.equal(world.canStand(PLAYER_START.x, PLAYER_START.z, 0.31, 0), true, 'Player start must be clear')

assert.notEqual(world.cellAt(HOSPITAL.x - HOSPITAL.width / 2, HOSPITAL.z + 8, 0).wall, WALL.EMPTY, 'Hospital west wall is missing')
assert.notEqual(world.cellAt(HOSPITAL.x + HOSPITAL.width / 2, HOSPITAL.z + 8, 0).wall, WALL.EMPTY, 'Hospital east wall is missing')
assert.equal(world.canStand(176, 83, 0.25, 0), true, 'Hospital emergency entrance must be open')
assert.equal(world.canStand(176, 106, 0.25, 0), true, 'Hospital central corridor must be walkable')
assert.equal(world.canStand(145, 106, 0.25, 0), true, 'Hospital longitudinal corridor must remain open')

assert.equal(world.canStand(BAR.x, BAR.z - BAR.depth / 2, 0.25, 0), true, 'Bar front door must be open')
assert.ok(world.interactionAt(112, 90, 0), 'Bar stair interaction must exist')
assert.equal(world.canStand(112, 77, 0.25, 1), true, 'Upper balcony must be walkable')
assert.ok(world.spawnPoints.length >= 16, 'Authored zombie fronts should survive collision filtering')

console.log(`Map validation passed with ${world.spawnPoints.length} active zombie fronts.`)
