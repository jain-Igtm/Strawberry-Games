import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const scriptsDirectory = import.meta.dirname
const sourcePath = resolve(scriptsDirectory, 'apply-feedback-pass.mjs')
const runtimePath = resolve(scriptsDirectory, '.apply-feedback-runtime.mjs')

let source = readFileSync(sourcePath, 'utf8')
const literalMarkerReplacement = '"import \'./styles.css\'\\n\\n' + '${marker}' + '",'
const evaluatedMarkerReplacement = '"import \'./styles.css\'\\n\\n" + marker,'

if (!source.includes(literalMarkerReplacement)) {
  throw new Error('Could not repair feedback marker replacement.')
}

source = source.replace(literalMarkerReplacement, evaluatedMarkerReplacement)
writeFileSync(runtimePath, source)

try {
  await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`)
} finally {
  unlinkSync(runtimePath)
}
