import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const manifestPath = resolve(root, 'android/app/src/main/AndroidManifest.xml')
const stylesPath = resolve(root, 'android/app/src/main/res/values/styles.xml')

let manifest = await readFile(manifestPath, 'utf8')
if (!manifest.includes('android:screenOrientation="landscape"')) {
  manifest = manifest.replace(
    /<activity\b/,
    '<activity\n            android:screenOrientation="landscape"',
  )
}
await writeFile(manifestPath, manifest)

let styles = await readFile(stylesPath, 'utf8')
const additions = [
  '<item name="android:windowFullscreen">true</item>',
  '<item name="android:windowActionModeOverlay">true</item>',
  '<item name="android:windowNoTitle">true</item>',
  '<item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>',
  '<item name="android:navigationBarColor">#151311</item>',
  '<item name="android:statusBarColor">#151311</item>',
]
const targetStyle = /(<style\s+name="AppTheme\.NoActionBar"[^>]*>[\s\S]*?)(\s*<\/style>)/
for (const item of additions) {
  if (!styles.includes(item)) {
    if (targetStyle.test(styles)) styles = styles.replace(targetStyle, `$1\n        ${item}$2`)
    else styles = styles.replace('</style>', `        ${item}\n    </style>`)
  }
}
await writeFile(stylesPath, styles)
console.log('Configured landscape fullscreen Android wrapper.')
