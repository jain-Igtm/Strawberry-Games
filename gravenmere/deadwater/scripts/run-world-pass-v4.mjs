import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const scriptsDirectory = import.meta.dirname
const sourcePath = resolve(scriptsDirectory, 'apply-world-pass-v4.mjs')
const runtimePath = resolve(scriptsDirectory, '.apply-world-pass-v4-runtime.mjs')

let source = readFileSync(sourcePath, 'utf8')
const broken = '    showToast(`${definition.name} ACQUIRED`, 2.1)'
const repaired = '    showToast(\\`\\${definition.name} ACQUIRED\\`, 2.1)'

if (!source.includes(broken)) {
  throw new Error('Could not repair the world-pass weapon pickup template.')
}
source = source.replace(broken, repaired)
writeFileSync(runtimePath, source)

try {
  await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`)
} finally {
  unlinkSync(runtimePath)
}
