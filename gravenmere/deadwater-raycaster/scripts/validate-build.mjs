import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const required = [
  'www/index.html',
  'www/styles.css',
  'www/js/map.js',
  'www/js/textures.js',
  'www/js/engine.js',
  'www/js/game.js',
  'capacitor.config.json',
]

for (const relative of required) {
  const path = resolve(root, relative)
  const info = await stat(path)
  if (!info.isFile() || info.size === 0) throw new Error(`Missing build input: ${relative}`)
}

const sourceFiles = required.filter((file) => file.endsWith('.js'))
for (const relative of sourceFiles) {
  const source = await readFile(resolve(root, relative), 'utf8')
  if (/from\s+['"]three['"]|import\s+\*\s+as\s+THREE/.test(source)) {
    throw new Error(`Three.js reference found in ${relative}`)
  }
}

const html = await readFile(resolve(root, 'www/index.html'), 'utf8')
if (!html.includes('type="module" src="./js/game.js"')) throw new Error('Game module is not wired into index.html')
console.log('Validated dependency-free Ashfall raycaster web build.')
