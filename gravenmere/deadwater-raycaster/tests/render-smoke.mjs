import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildWorld, PLAYER_START } from '../www/js/map.js'
import { createTextureSet } from '../www/js/textures.js'
import { RaycastEngine } from '../www/js/engine.js'

class MockContext {
  createImageData(width, height) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) }
  }
  putImageData(image) {
    this.lastImage = image
  }
}

const context = new MockContext()
const canvas = {
  width: 0,
  height: 0,
  getContext() { return context },
}
const world = buildWorld()
const textures = createTextureSet()
const renderer = new RaycastEngine(canvas, world, textures)
const player = {
  x: PLAYER_START.x,
  z: PLAYER_START.z,
  angle: PLAYER_START.angle,
  level: 0,
  health: 100,
  velocityX: 0,
  velocityZ: 0,
}
const zombies = [
  { x: 112, z: 63, level: 0, dead: false, scale: 0.88, texture: textures.zombies[0], type: 'zombie' },
  { x: 130, z: 66, level: 0, dead: false, scale: 0.9, texture: textures.zombies[1], type: 'zombie' },
]
renderer.setEntities(zombies)
renderer.render(player, 1.2, 16.7)
if (!context.lastImage) throw new Error('Raycaster did not submit a rendered frame')
const output = resolve(import.meta.dirname, 'render-smoke.rgba')
await writeFile(output, Buffer.from(context.lastImage.data.buffer))
const nonBlack = context.lastImage.data.reduce((count, value, index) => count + (index % 4 !== 3 && value > 8 ? 1 : 0), 0)
if (nonBlack < 10000) throw new Error(`Rendered frame is unexpectedly empty: ${nonBlack}`)
console.log(JSON.stringify({ width: context.lastImage.width, height: context.lastImage.height, nonBlack, output }))
