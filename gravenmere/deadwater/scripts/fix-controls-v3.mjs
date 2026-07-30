import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve(import.meta.dirname, '../src/main.ts')
let source = readFileSync(sourcePath, 'utf8')
const marker = '// DEADWATER_CONTROLS_V3'

if (source.includes(marker)) {
  console.log('Deadwater controls v3 already applied.')
  process.exit(0)
}

function replaceRequired(label, search, replacement) {
  const next = source.replace(search, replacement)
  if (next === source) throw new Error(`Could not apply controls v3 patch: ${label}`)
  source = next
}

replaceRequired(
  'marker',
  '// DEADWATER_FEEDBACK_PASS_V2',
  `// DEADWATER_FEEDBACK_PASS_V2\n${marker}`,
)

// Restore conventional direct-drag camera controls:
// drag right turns right; drag up looks up.
replaceRequired('touch yaw', 'player.yaw += dx * 0.0048', 'player.yaw -= dx * 0.0048')
replaceRequired('touch pitch', 'player.pitch += dy * 0.0042', 'player.pitch -= dy * 0.0042')

// Match movement to the camera's actual horizontal forward/right vectors.
// The previous forward vector pointed exactly behind the camera.
replaceRequired(
  'movement x vector',
  'const dx = (sin * forward + cos * strafe) * speed * dt',
  'const dx = (-sin * forward + cos * strafe) * speed * dt',
)
replaceRequired(
  'movement z vector',
  'const dz = (cos * forward - sin * strafe) * speed * dt',
  'const dz = (-cos * forward - sin * strafe) * speed * dt',
)

writeFileSync(sourcePath, source)
console.log('Applied Deadwater controls v3: camera-relative movement and normal drag look.')
