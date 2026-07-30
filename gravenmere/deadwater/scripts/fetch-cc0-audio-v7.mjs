import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const outputDirectory = resolve(import.meta.dirname, '../public/audio-v7')
await mkdir(outputDirectory, { recursive: true })

const assets = [
  {
    name: 'zombie-groan-1.ogg',
    required: true,
    urls: [
      'https://raw.githubusercontent.com/prestonpope192/zombie_invasion/f8b2c8346cfda2288af91c6714a54fd93073dda4/public/audio/zombie-groan-1.ogg',
      'https://opengameart.org/sites/default/files/darsycho__zombie-moans_0.ogg',
    ],
  },
  {
    name: 'zombie-groan-2.ogg',
    required: true,
    urls: [
      'https://raw.githubusercontent.com/prestonpope192/zombie_invasion/f8b2c8346cfda2288af91c6714a54fd93073dda4/public/audio/zombie-groan-2.ogg',
    ],
  },
  {
    name: 'zombie-groan-3.ogg',
    required: true,
    urls: [
      'https://raw.githubusercontent.com/prestonpope192/zombie_invasion/f8b2c8346cfda2288af91c6714a54fd93073dda4/public/audio/zombie-groan-3.ogg',
    ],
  },
  {
    name: 'storm-siren.ogg',
    required: true,
    urls: [
      'https://opengameart.org/sites/default/files/storm_3_siren.ogg',
      'https://raw.githubusercontent.com/charliedavenport/FPS_Project/bcf450b2153ba6c1e1edad0967a53294ec7d0731/Assets/Sound/storm_3_siren.ogg',
    ],
  },
  {
    name: 'warning-siren.mp3',
    required: false,
    urls: [
      'https://opengameart.org/sites/default/files/siren_0.mp3',
    ],
  },
]

async function existingFileIsUsable(path) {
  try {
    return (await stat(path)).size > 2048
  } catch {
    return false
  }
}

async function downloadCandidate(url) {
  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Ashfall-Deadwater-build/7.0',
          Accept: 'audio/ogg,audio/mpeg,audio/*;q=0.9,*/*;q=0.2',
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('text/html')) throw new Error(`Unexpected ${contentType}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength < 2048) throw new Error(`File was only ${bytes.byteLength} bytes`)
      return bytes
    } catch (error) {
      lastError = error
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 350 * attempt))
    }
  }
  throw lastError ?? new Error('Download failed')
}

for (const asset of assets) {
  const destination = resolve(outputDirectory, asset.name)
  if (await existingFileIsUsable(destination)) {
    console.log(`Using cached ${asset.name}`)
    continue
  }

  let downloaded = false
  let lastError = null
  for (const url of asset.urls) {
    try {
      const bytes = await downloadCandidate(url)
      const temporary = destination + '.partial'
      await writeFile(temporary, bytes)
      await rename(temporary, destination)
      console.log(`Downloaded ${asset.name} (${bytes.byteLength} bytes)`)
      downloaded = true
      break
    } catch (error) {
      lastError = error
      console.warn(`Could not download ${asset.name} from ${url}: ${String(error)}`)
    }
  }

  if (!downloaded && asset.required) {
    throw new Error(`Required CC0 audio ${asset.name} was unavailable: ${String(lastError)}`)
  }
  if (!downloaded) {
    try { await unlink(destination + '.partial') } catch { /* no partial file */ }
  }
}
