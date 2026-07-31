import { FLOOR, ORIGIN_X, ORIGIN_Z, WALL } from './map.js'

const INTERNAL_WIDTH = 400
const INTERNAL_HEIGHT = 225
const FOV_PLANE = 0.66
const TEX_SIZE = 64

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function angleDelta(a, b) {
  let delta = a - b
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

export class RaycastEngine {
  constructor(canvas, world, textures) {
    this.canvas = canvas
    this.canvas.width = INTERNAL_WIDTH
    this.canvas.height = INTERNAL_HEIGHT
    this.context = canvas.getContext('2d', { alpha: false })
    this.context.imageSmoothingEnabled = false
    this.frame = this.context.createImageData(INTERNAL_WIDTH, INTERNAL_HEIGHT)
    this.pixels = this.frame.data
    this.depth = new Float32Array(INTERNAL_WIDTH)
    this.world = world
    this.textures = textures
    this.entities = []
    this.cameraBob = 0
    this.flash = 0
    this.damageFlash = 0
    this.fps = 60
    this.lastFrameDuration = 16.7
  }

  setEntities(entities) {
    this.entities = entities
  }

  render(player, elapsed, frameDuration = 16.7) {
    this.lastFrameDuration = frameDuration
    this.fps += ((1000 / Math.max(1, frameDuration)) - this.fps) * 0.06
    const moving = Math.hypot(player.velocityX ?? 0, player.velocityZ ?? 0) > 0.2
    this.cameraBob = moving ? Math.sin(elapsed * 10.5) * 2.2 : this.cameraBob * 0.86
    this._renderSkyAndFloor(player)
    this._renderWalls(player)
    this._renderSprites(player)
    this._applyScreenEffects(player)
    this.context.putImageData(this.frame, 0, 0)
    this.flash = Math.max(0, this.flash - frameDuration * 0.006)
    this.damageFlash = Math.max(0, this.damageFlash - frameDuration * 0.0028)
  }

  _renderSkyAndFloor(player) {
    const horizon = Math.floor(INTERNAL_HEIGHT * 0.49 + this.cameraBob)
    const dirX = Math.cos(player.angle)
    const dirZ = Math.sin(player.angle)
    const planeX = -dirZ * FOV_PLANE
    const planeZ = dirX * FOV_PLANE
    const rayDirX0 = dirX - planeX
    const rayDirZ0 = dirZ - planeZ
    const rayDirX1 = dirX + planeX
    const rayDirZ1 = dirZ + planeZ

    for (let y = 0; y <= horizon; y += 1) {
      const t = y / Math.max(1, horizon)
      const ashBand = Math.max(0, Math.sin((t * 5.2 + player.angle * 0.11)) * 4)
      const r = 57 + t * 16 + ashBand
      const g = 57 + t * 14 + ashBand * 0.7
      const b = 59 + t * 12 + ashBand * 0.45
      for (let x = 0; x < INTERNAL_WIDTH; x += 1) {
        const index = (y * INTERNAL_WIDTH + x) * 4
        this.pixels[index] = r
        this.pixels[index + 1] = g
        this.pixels[index + 2] = b
        this.pixels[index + 3] = 255
      }
    }

    const cameraHeight = player.level === 1 ? 0.58 : 0.52
    const interiorFloors = new Set([FLOOR.WOOD, FLOOR.CONCRETE, FLOOR.HOSPITAL])
    for (let y = horizon - 1; y >= 0; y -= 1) {
      const row = horizon - y
      const rowDistance = (cameraHeight * INTERNAL_HEIGHT) / Math.max(1, row)
      const stepX = rowDistance * (rayDirX1 - rayDirX0) / INTERNAL_WIDTH
      const stepZ = rowDistance * (rayDirZ1 - rayDirZ0) / INTERNAL_WIDTH
      let ceilingX = player.x + rowDistance * rayDirX0
      let ceilingZ = player.z + rowDistance * rayDirZ0
      const distanceShade = clamp(0.68 - rowDistance / 310, 0.19, 0.68)
      for (let x = 0; x < INTERNAL_WIDTH; x += 1) {
        const floorType = this.world.floorAt(ceilingX, ceilingZ, player.level)
        if (interiorFloors.has(floorType)) {
          const texture = this.textures.floors[floorType] ?? this.textures.floors[FLOOR.CONCRETE]
          const tx = ((Math.floor(ceilingX * 13) % TEX_SIZE) + TEX_SIZE) % TEX_SIZE
          const ty = ((Math.floor(ceilingZ * 13) % TEX_SIZE) + TEX_SIZE) % TEX_SIZE
          const source = (ty * TEX_SIZE + tx) * 4
          const target = (y * INTERNAL_WIDTH + x) * 4
          const ceilingTint = floorType === FLOOR.HOSPITAL ? 0.9 : 0.72
          this.pixels[target] = texture.data[source] * distanceShade * ceilingTint
          this.pixels[target + 1] = texture.data[source + 1] * distanceShade * ceilingTint
          this.pixels[target + 2] = texture.data[source + 2] * distanceShade * ceilingTint
          this.pixels[target + 3] = 255
        }
        ceilingX += stepX
        ceilingZ += stepZ
      }
    }

    for (let y = horizon + 1; y < INTERNAL_HEIGHT; y += 1) {
      const row = y - horizon
      const rowDistance = (cameraHeight * INTERNAL_HEIGHT) / Math.max(1, row)
      const stepX = rowDistance * (rayDirX1 - rayDirX0) / INTERNAL_WIDTH
      const stepZ = rowDistance * (rayDirZ1 - rayDirZ0) / INTERNAL_WIDTH
      let floorX = player.x + rowDistance * rayDirX0
      let floorZ = player.z + rowDistance * rayDirZ0
      const distanceShade = clamp(1 - rowDistance / 165, 0.24, 1)
      for (let x = 0; x < INTERNAL_WIDTH; x += 1) {
        const floorType = this.world.floorAt(floorX, floorZ, player.level)
        const texture = this.textures.floors[floorType] ?? this.textures.floors[FLOOR.SOIL]
        const tx = ((Math.floor(floorX * 16) % TEX_SIZE) + TEX_SIZE) % TEX_SIZE
        const ty = ((Math.floor(floorZ * 16) % TEX_SIZE) + TEX_SIZE) % TEX_SIZE
        const source = (ty * TEX_SIZE + tx) * 4
        const target = (y * INTERNAL_WIDTH + x) * 4
        const levelShade = player.level === 1 ? 0.82 : 1
        this.pixels[target] = texture.data[source] * distanceShade * levelShade
        this.pixels[target + 1] = texture.data[source + 1] * distanceShade * levelShade
        this.pixels[target + 2] = texture.data[source + 2] * distanceShade * levelShade
        this.pixels[target + 3] = 255
        floorX += stepX
        floorZ += stepZ
      }
    }
  }

  castRay(player, angle, maxDistance = 260) {
    const rayDirX = Math.cos(angle)
    const rayDirZ = Math.sin(angle)
    let mapX = Math.floor(player.x - ORIGIN_X)
    let mapZ = Math.floor(player.z - ORIGIN_Z)
    const deltaDistX = Math.abs(1 / (rayDirX || 1e-9))
    const deltaDistZ = Math.abs(1 / (rayDirZ || 1e-9))
    const stepX = rayDirX < 0 ? -1 : 1
    const stepZ = rayDirZ < 0 ? -1 : 1
    let sideDistX = rayDirX < 0
      ? (player.x - ORIGIN_X - mapX) * deltaDistX
      : (mapX + 1 - (player.x - ORIGIN_X)) * deltaDistX
    let sideDistZ = rayDirZ < 0
      ? (player.z - ORIGIN_Z - mapZ) * deltaDistZ
      : (mapZ + 1 - (player.z - ORIGIN_Z)) * deltaDistZ

    let side = 0
    let distance = 0
    let wall = WALL.EMPTY
    let cellHeight = 1
    for (let steps = 0; steps < 600; steps += 1) {
      if (sideDistX < sideDistZ) {
        sideDistX += deltaDistX
        mapX += stepX
        side = 0
      } else {
        sideDistZ += deltaDistZ
        mapZ += stepZ
        side = 1
      }
      const worldX = mapX + ORIGIN_X + 0.5
      const worldZ = mapZ + ORIGIN_Z + 0.5
      const cell = this.world.cellAt(worldX, worldZ, player.level)
      wall = cell.wall
      cellHeight = cell.height
      distance = side === 0
        ? (mapX - (player.x - ORIGIN_X) + (1 - stepX) * 0.5) / (rayDirX || 1e-9)
        : (mapZ - (player.z - ORIGIN_Z) + (1 - stepZ) * 0.5) / (rayDirZ || 1e-9)
      if (wall !== WALL.EMPTY || distance >= maxDistance) {
        return { distance: Math.abs(distance), side, wall, height: cellHeight, mapX, mapZ, rayDirX, rayDirZ }
      }
    }
    return { distance: maxDistance, side, wall: WALL.EMPTY, height: 1, mapX, mapZ, rayDirX, rayDirZ }
  }

  _renderWalls(player) {
    const dirX = Math.cos(player.angle)
    const dirZ = Math.sin(player.angle)
    const planeX = -dirZ * FOV_PLANE
    const planeZ = dirX * FOV_PLANE
    const horizon = INTERNAL_HEIGHT * 0.49 + this.cameraBob

    for (let x = 0; x < INTERNAL_WIDTH; x += 1) {
      const cameraX = 2 * x / INTERNAL_WIDTH - 1
      const rayDirX = dirX + planeX * cameraX
      const rayDirZ = dirZ + planeZ * cameraX
      const angle = Math.atan2(rayDirZ, rayDirX)
      const hit = this.castRay(player, angle)
      const correctedDistance = Math.max(0.08, hit.distance * Math.cos(angleDelta(angle, player.angle)))
      this.depth[x] = correctedDistance
      if (hit.wall === WALL.EMPTY) continue

      const heightScale = hit.height || 1
      const lineHeight = Math.floor((INTERNAL_HEIGHT / correctedDistance) * heightScale)
      const drawStart = Math.floor(horizon - lineHeight * 0.5)
      const drawEnd = Math.floor(horizon + lineHeight * 0.5)
      const texture = this.textures.walls[hit.wall] ?? this.textures.walls[WALL.CONCRETE]
      let wallX = hit.side === 0
        ? player.z + hit.distance * hit.rayDirZ
        : player.x + hit.distance * hit.rayDirX
      wallX -= Math.floor(wallX)
      let texX = Math.floor(wallX * TEX_SIZE)
      if (hit.side === 0 && hit.rayDirX > 0) texX = TEX_SIZE - texX - 1
      if (hit.side === 1 && hit.rayDirZ < 0) texX = TEX_SIZE - texX - 1
      const distanceShade = clamp(1 - correctedDistance / 110, 0.18, 1) * (hit.side === 1 ? 0.82 : 1)
      const top = Math.max(0, drawStart)
      const bottom = Math.min(INTERNAL_HEIGHT - 1, drawEnd)
      for (let y = top; y <= bottom; y += 1) {
        const texY = Math.floor(((y - drawStart) / Math.max(1, drawEnd - drawStart)) * TEX_SIZE) & (TEX_SIZE - 1)
        const source = (texY * TEX_SIZE + texX) * 4
        const target = (y * INTERNAL_WIDTH + x) * 4
        this.pixels[target] = texture.data[source] * distanceShade
        this.pixels[target + 1] = texture.data[source + 1] * distanceShade
        this.pixels[target + 2] = texture.data[source + 2] * distanceShade
        this.pixels[target + 3] = 255
      }
    }
  }

  _renderSprites(player) {
    const dirX = Math.cos(player.angle)
    const dirZ = Math.sin(player.angle)
    const planeX = -dirZ * FOV_PLANE
    const planeZ = dirX * FOV_PLANE
    const inverse = 1 / (planeX * dirZ - dirX * planeZ)
    const horizon = INTERNAL_HEIGHT * 0.49 + this.cameraBob
    const renderables = []

    for (const entity of this.entities) {
      if (entity.dead || entity.level !== player.level) continue
      renderables.push({ ...entity, distanceSquared: (entity.x - player.x) ** 2 + (entity.z - player.z) ** 2 })
    }
    for (const landmark of this.world.landmarks) {
      if ((landmark.level ?? 0) !== player.level) continue
      renderables.push({
        ...landmark,
        texture: landmark.type === 'plume' ? this.textures.plume : this.textures.getLandmark(landmark.type),
        distanceSquared: (landmark.x - player.x) ** 2 + (landmark.z - player.z) ** 2,
        nonCombat: true,
      })
    }
    renderables.sort((a, b) => b.distanceSquared - a.distanceSquared)

    for (const sprite of renderables) {
      const dx = sprite.x - player.x
      const dz = sprite.z - player.z
      const transformX = inverse * (dirZ * dx - dirX * dz)
      const transformY = inverse * (-planeZ * dx + planeX * dz)
      if (transformY <= 0.05) continue
      const screenX = Math.floor((INTERNAL_WIDTH * 0.5) * (1 + transformX / transformY))
      const texture = sprite.texture
      const baseScale = sprite.scale ?? 1
      const spriteHeight = Math.abs(Math.floor((INTERNAL_HEIGHT / transformY) * baseScale))
      const aspect = texture.width / texture.height
      const spriteWidth = Math.max(1, Math.floor(spriteHeight * aspect))
      const verticalOffset = sprite.vertical ?? 0
      const centerY = horizon - spriteHeight * verticalOffset
      const startY = Math.floor(centerY - spriteHeight * 0.5)
      const endY = Math.floor(centerY + spriteHeight * 0.5)
      const startX = Math.floor(screenX - spriteWidth * 0.5)
      const endX = Math.floor(screenX + spriteWidth * 0.5)
      const shade = sprite.type === 'plume' ? 0.9 : clamp(1 - transformY / 95, 0.25, 1)

      for (let stripe = Math.max(0, startX); stripe < Math.min(INTERNAL_WIDTH, endX); stripe += 1) {
        if (transformY >= this.depth[stripe]) continue
        const texX = Math.floor(((stripe - startX) / Math.max(1, endX - startX)) * texture.width)
        for (let y = Math.max(0, startY); y < Math.min(INTERNAL_HEIGHT, endY); y += 1) {
          const texY = Math.floor(((y - startY) / Math.max(1, endY - startY)) * texture.height)
          const source = (texY * texture.width + texX) * 4
          const alpha = texture.data[source + 3]
          if (alpha < 24) continue
          const target = (y * INTERNAL_WIDTH + stripe) * 4
          const mix = alpha / 255
          this.pixels[target] = this.pixels[target] * (1 - mix) + texture.data[source] * shade * mix
          this.pixels[target + 1] = this.pixels[target + 1] * (1 - mix) + texture.data[source + 1] * shade * mix
          this.pixels[target + 2] = this.pixels[target + 2] * (1 - mix) + texture.data[source + 2] * shade * mix
          this.pixels[target + 3] = 255
        }
      }
    }
  }

  _applyScreenEffects(player) {
    const width = INTERNAL_WIDTH
    const height = INTERNAL_HEIGHT
    const lowHealth = clamp((35 - player.health) / 35, 0, 1)
    const redStrength = Math.max(lowHealth * 0.26, this.damageFlash * 0.35)
    if (redStrength > 0.005) {
      for (let y = 0; y < height; y += 1) {
        const edgeY = Math.abs(y / height - 0.5) * 2
        for (let x = 0; x < width; x += 1) {
          const edgeX = Math.abs(x / width - 0.5) * 2
          const vignette = clamp((Math.max(edgeX, edgeY) - 0.45) / 0.55, 0, 1) * redStrength
          const target = (y * width + x) * 4
          this.pixels[target] = this.pixels[target] * (1 - vignette) + 116 * vignette
          this.pixels[target + 1] *= 1 - vignette * 0.72
          this.pixels[target + 2] *= 1 - vignette * 0.76
        }
      }
    }

    if (this.flash > 0) {
      const strength = clamp(this.flash, 0, 1)
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const target = (y * width + x) * 4
          this.pixels[target] = this.pixels[target] * (1 - strength) + 228 * strength
          this.pixels[target + 1] = this.pixels[target + 1] * (1 - strength) + 174 * strength
          this.pixels[target + 2] = this.pixels[target + 2] * (1 - strength) + 112 * strength
        }
      }
    }
  }

  muzzleFlash() {
    this.flash = 0.16
  }

  showDamage() {
    this.damageFlash = 1
  }

  visibleDistance(player, targetX, targetZ) {
    const angle = Math.atan2(targetZ - player.z, targetX - player.x)
    return this.castRay(player, angle).distance
  }

  pickTarget(player, entities, maxRange = 42) {
    let best = null
    let bestScore = Number.POSITIVE_INFINITY
    for (const entity of entities) {
      if (entity.dead || entity.level !== player.level) continue
      const dx = entity.x - player.x
      const dz = entity.z - player.z
      const distance = Math.hypot(dx, dz)
      if (distance > maxRange) continue
      const targetAngle = Math.atan2(dz, dx)
      const delta = Math.abs(angleDelta(targetAngle, player.angle))
      const angularRadius = clamp(0.7 / Math.max(1, distance), 0.015, 0.12)
      if (delta > angularRadius) continue
      const wallDistance = this.visibleDistance(player, entity.x, entity.z)
      if (wallDistance + 0.35 < distance) continue
      const score = delta * 9 + distance * 0.014
      if (score < bestScore) {
        bestScore = score
        best = entity
      }
    }
    return best
  }
}
