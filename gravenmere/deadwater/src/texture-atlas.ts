import * as THREE from 'three'
import { GAMEPLAY_ATLAS_V16 } from './generated-textures-v16'
import { CASTLE_ROMEO_JPEG_V17 } from './generated-assets-v17'

export type AtlasTile = Readonly<{
  u: number
  v: number
  width: number
  height: number
}>

const TILE_INSET = 0.006
const TILE_SIZE = 0.5 - TILE_INSET * 2

export const ATLAS_TILES = {
  topLeft: {
    u: TILE_INSET,
    v: 0.5 + TILE_INSET,
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  topRight: {
    u: 0.5 + TILE_INSET,
    v: 0.5 + TILE_INSET,
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  bottomLeft: {
    u: TILE_INSET,
    v: TILE_INSET,
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  bottomRight: {
    u: 0.5 + TILE_INSET,
    v: TILE_INSET,
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
} as const satisfies Record<string, AtlasTile>

const textureRoot = './assets/textures/'
const loader = typeof document === 'undefined' ? null : new THREE.TextureLoader()

function loadAtlas(source: string): THREE.Texture {
  const url = source.startsWith('data:') ? source : textureRoot + source
  const texture = loader ? loader.load(url) : new THREE.Texture()
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  return texture
}

export const gameplayAtlasTexture = loadAtlas(GAMEPLAY_ATLAS_V16)
export const gunAtlasTexture = gameplayAtlasTexture
export const forestAtlasTexture = loadAtlas('forest-atlas.webp')
export const mushroomCloudTexture = loadAtlas(CASTLE_ROMEO_JPEG_V17)

export function mapGeometryToAtlas<T extends THREE.BufferGeometry>(
  geometry: T,
  tile: AtlasTile,
): T {
  const uv = geometry.getAttribute('uv')
  if (!uv) return geometry
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(
      index,
      tile.u + THREE.MathUtils.clamp(uv.getX(index), 0, 1) * tile.width,
      tile.v + THREE.MathUtils.clamp(uv.getY(index), 0, 1) * tile.height,
    )
  }
  uv.needsUpdate = true
  return geometry
}

export function configureAtlasTextures(renderer: THREE.WebGLRenderer): void {
  const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  for (const texture of [
    gameplayAtlasTexture,
    forestAtlasTexture,
    mushroomCloudTexture,
  ]) {
    texture.anisotropy = anisotropy
    texture.needsUpdate = true
  }
}

export function installAshfallSky(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
): void {
  const fallback = new THREE.Color(0x170f0d)
  scene.background = fallback
  if (!loader) return
  const sky = loader.load(
    textureRoot + 'ashfall-sky.webp',
    () => {
      scene.background = sky
    },
    undefined,
    () => {
      scene.background = fallback
    },
  )
  sky.colorSpace = THREE.SRGBColorSpace
  sky.mapping = THREE.EquirectangularReflectionMapping
  sky.minFilter = THREE.LinearMipmapLinearFilter
  sky.magFilter = THREE.LinearFilter
  sky.generateMipmaps = true
  sky.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy())
}
