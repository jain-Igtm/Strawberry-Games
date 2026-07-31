import { FLOOR, WALL } from './map.js'

const SIZE = 64

function seeded(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function texture(draw, seed = 1) {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4)
  const random = seeded(seed)
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
    const i = (y * SIZE + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }
  const fill = (r, g, b, a = 255) => {
    for (let y = 0; y < SIZE; y += 1) for (let x = 0; x < SIZE; x += 1) set(x, y, r, g, b, a)
  }
  draw({ data, random, set, fill, size: SIZE })
  return { width: SIZE, height: SIZE, data }
}

function noisyBase(r, g, b, amount, seed) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const noise = (random() - 0.5) * amount
        set(x, y, r + noise, g + noise, b + noise)
      }
    }
  }, seed)
}

function brick(seed = 10) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      const row = Math.floor(y / 12)
      const mortarY = y % 12 < 2
      for (let x = 0; x < size; x += 1) {
        const shifted = (x + (row % 2) * 12) % 24
        const mortar = mortarY || shifted < 2
        if (mortar) set(x, y, 40, 31, 28)
        else {
          const n = (random() - 0.5) * 24
          set(x, y, 93 + n, 54 + n * 0.45, 42 + n * 0.35)
        }
      }
    }
  }, seed)
}

function boards(seed = 20) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const seam = x % 12 < 2
        const grain = Math.sin(y * 0.31 + x * 0.08) * 6 + (random() - 0.5) * 10
        if (seam) set(x, y, 37, 39, 36)
        else set(x, y, 78 + grain, 86 + grain, 80 + grain * 0.7)
      }
    }
  }, seed)
}

function concrete(seed = 30) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const n = (random() - 0.5) * 20
        const crack = ((x * 13 + y * 7 + seed) % 97 === 0) || (Math.abs(x - y * 0.43 - 18) < 0.6 && y > 17)
        if (crack) set(x, y, 45, 43, 40)
        else set(x, y, 105 + n, 103 + n, 98 + n)
      }
    }
  }, seed)
}

function hospital(seed = 40) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const tileLine = x % 16 < 1 || y % 16 < 1
        const stain = y > 40 && random() < 0.04
        if (tileLine) set(x, y, 89, 96, 91)
        else if (stain) set(x, y, 92, 72, 57)
        else {
          const n = (random() - 0.5) * 8
          set(x, y, 155 + n, 162 + n, 153 + n)
        }
      }
    }
  }, seed)
}

function metal(seed = 50) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const seam = x % 20 < 2
        const rust = random() < 0.035
        const n = Math.sin(x * 0.55) * 8 + (random() - 0.5) * 8
        if (seam) set(x, y, 35, 37, 38)
        else if (rust) set(x, y, 123, 65, 37)
        else set(x, y, 86 + n, 91 + n, 93 + n)
      }
    }
  }, seed)
}

function forest(seed = 60) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const trunk = (x % 17 < 4 && y > 20)
        const branch = ((x + y * 2) % 23 < 5 && y < 50)
        const glow = y > 47 && random() < 0.12
        if (glow) set(x, y, 139, 51, 24)
        else if (trunk) set(x, y, 35, 28, 22)
        else if (branch) set(x, y, 21, 32, 24)
        else set(x, y, 9 + random() * 12, 17 + random() * 16, 12 + random() * 10)
      }
    }
  }, seed)
}

function glass(seed = 70) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const bar = x % 22 < 2 || y % 22 < 2
        const shine = Math.abs(x - (size - y)) < 2
        if (bar) set(x, y, 24, 32, 34)
        else if (shine) set(x, y, 116, 137, 139)
        else set(x, y, 47 + random() * 8, 66 + random() * 10, 69 + random() * 11)
      }
    }
  }, seed)
}

function warning(seed = 80) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const stripe = ((x + y) % 24) < 12
        const n = (random() - 0.5) * 12
        if (stripe) set(x, y, 153 + n, 110 + n, 42 + n * 0.4)
        else set(x, y, 40 + n, 37 + n, 34 + n)
      }
    }
  }, seed)
}

function asphalt(seed = 90) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const aggregate = random() < 0.08
        const crack = Math.abs(x - 18 - Math.sin(y * 0.2) * 3) < 0.65 && y > 10
        const n = (random() - 0.5) * 15
        if (crack) set(x, y, 28, 27, 26)
        else if (aggregate) set(x, y, 78 + n, 75 + n, 70 + n)
        else set(x, y, 52 + n, 50 + n, 47 + n)
      }
    }
  }, seed)
}

function sidewalk(seed = 100) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const joint = x % 32 < 2 || y % 32 < 2
        const n = (random() - 0.5) * 14
        if (joint) set(x, y, 66, 63, 59)
        else set(x, y, 112 + n, 108 + n, 101 + n)
      }
    }
  }, seed)
}

function woodFloor(seed = 110) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const seam = y % 10 < 1
        const stagger = ((x + Math.floor(y / 10) * 17) % 32) < 1
        const n = Math.sin(x * 0.3) * 6 + (random() - 0.5) * 8
        if (seam || stagger) set(x, y, 49, 37, 29)
        else set(x, y, 104 + n, 75 + n * 0.55, 52 + n * 0.35)
      }
    }
  }, seed)
}

function soil(seed = 120) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const grass = random() < 0.055
        const n = (random() - 0.5) * 16
        if (grass) set(x, y, 58, 65, 42)
        else set(x, y, 72 + n, 63 + n * 0.8, 50 + n * 0.6)
      }
    }
  }, seed)
}

function forestFloor(seed = 130) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const ember = random() < 0.025
        const needle = (x * 5 + y * 11) % 29 < 2
        if (ember) set(x, y, 128, 49, 20)
        else if (needle) set(x, y, 44, 47, 28)
        else set(x, y, 24 + random() * 14, 26 + random() * 13, 19 + random() * 8)
      }
    }
  }, seed)
}

function roadLine(seed = 160) {
  return texture(({ random, set, size }) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const worn = random() < 0.09 || ((x * 11 + y * 7) % 53 === 0)
        const n = (random() - 0.5) * 18
        if (worn) set(x, y, 86 + n, 74 + n, 55 + n * 0.5)
        else set(x, y, 164 + n, 132 + n * 0.65, 69 + n * 0.25)
      }
    }
  }, seed)
}

function sprite(width, height, painter) {
  const data = new Uint8ClampedArray(width * height * 4)
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const i = (y * width + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }
  painter({ set, width, height })
  return { width, height, data }
}

function zombieSprite(variant = 0) {
  return sprite(48, 80, ({ set, width, height }) => {
    const random = seeded(400 + variant)
    const cx = width * 0.5
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const head = ((x - cx) / 9) ** 2 + ((y - 14) / 12) ** 2 < 1
        const torso = y >= 23 && y < 53 && Math.abs(x - cx - Math.sin(y * 0.17 + variant) * 1.8) < 10 - (y - 23) * 0.07
        const leftArm = y >= 29 && y < 56 && Math.abs(x - (cx - 12 - (y - 29) * 0.12)) < 3.2
        const rightArm = y >= 29 && y < 56 && Math.abs(x - (cx + 12 + (y - 29) * 0.1)) < 3.2
        const leftLeg = y >= 50 && y < 79 && Math.abs(x - (cx - 5 - (y - 50) * 0.04)) < 4
        const rightLeg = y >= 50 && y < 79 && Math.abs(x - (cx + 5 + (y - 50) * 0.04)) < 4
        if (!(head || torso || leftArm || rightArm || leftLeg || rightLeg)) continue
        const edge = x < 4 || x > width - 5 || y > height - 3
        const noise = (random() - 0.5) * 18
        if (head) set(x, y, 117 + noise, 117 + noise * 0.8, 99 + noise * 0.5, edge ? 210 : 255)
        else if (torso || leftArm || rightArm) set(x, y, 48 + noise, 55 + noise, 49 + noise * 0.6)
        else set(x, y, 39 + noise, 42 + noise, 42 + noise)
        if ((x + y * 3 + variant) % 41 === 0) set(x, y, 105, 40, 32)
      }
    }
    for (let x = 19; x <= 21; x += 1) set(x, 13, 14, 13, 12)
    for (let x = 27; x <= 29; x += 1) set(x, 13, 14, 13, 12)
  })
}

function plumeSprite() {
  return sprite(96, 128, ({ set, width, height }) => {
    const random = seeded(999)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const nx = (x - width * 0.5) / width
        const ny = y / height
        const stemWidth = 0.07 + ny * 0.07
        const stem = ny > 0.36 && Math.abs(nx) < stemWidth * (1 - (ny - 0.36) * 0.8)
        const capY = (ny - 0.27) / 0.23
        const capX = nx / (0.42 - Math.abs(capY) * 0.08)
        const cap = capY * capY + capX * capX < 1
        const shoulder = ((nx - 0.26) / 0.17) ** 2 + ((ny - 0.37) / 0.16) ** 2 < 1 ||
          ((nx + 0.26) / 0.17) ** 2 + ((ny - 0.37) / 0.16) ** 2 < 1
        if (!(stem || cap || shoulder)) continue
        const edgeNoise = random()
        const shade = 43 + edgeNoise * 15
        set(x, y, shade, shade + 1, shade + 2, 210 + random() * 45)
      }
    }
  })
}

function landmarkSprite(type) {
  return sprite(64, 80, ({ set, width, height }) => {
    const random = seeded(type.length * 71)
    if (type === 'water-tower') {
      for (let y = 8; y < 34; y += 1) {
        for (let x = 10; x < 54; x += 1) {
          const oval = ((x - 32) / 22) ** 2 + ((y - 21) / 14) ** 2 < 1
          if (oval) set(x, y, 92 + random() * 15, 88 + random() * 12, 82 + random() * 10)
        }
      }
      for (const lx of [17, 27, 37, 47]) for (let y = 31; y < 78; y += 1) set(lx + Math.round((y - 31) * (lx < 32 ? -0.08 : 0.08)), y, 58, 54, 49)
    } else if (type === 'vehicle') {
      for (let y = 37; y < 61; y += 1) for (let x = 8; x < 56; x += 1) set(x, y, 74, 69, 64)
      for (let y = 26; y < 42; y += 1) for (let x = 19; x < 48; x += 1) set(x, y, 57, 65, 67)
      for (const wheelX of [17, 47]) for (let y = 56; y < 68; y += 1) for (let x = wheelX - 6; x < wheelX + 6; x += 1) if ((x - wheelX) ** 2 + (y - 62) ** 2 < 34) set(x, y, 24, 24, 23)
    } else if (type === 'hospital-sign') {
      for (let y = 18; y < 56; y += 1) for (let x = 8; x < 56; x += 1) set(x, y, 155, 153, 145)
      for (let y = 24; y < 50; y += 1) for (let x = 29; x < 35; x += 1) set(x, y, 112, 36, 31)
      for (let y = 34; y < 40; y += 1) for (let x = 19; x < 45; x += 1) set(x, y, 112, 36, 31)
      for (let y = 56; y < 80; y += 1) for (const x of [18, 46]) set(x, y, 70, 68, 64)
    } else if (type === 'forge') {
      for (let y = 28; y < 72; y += 1) for (let x = 12; x < 52; x += 1) set(x, y, 44, 42, 39)
      for (let y = 41; y < 67; y += 1) for (let x = 19; x < 45; x += 1) {
        const heat = 1 - Math.abs(x - 32) / 14
        set(x, y, 145 + heat * 70, 50 + heat * 46, 20)
      }
    } else if (type === 'canopy') {
      for (let y = 22; y < 30; y += 1) for (let x = 2; x < 62; x += 1) set(x, y, 125, 118, 103)
      for (const x of [14, 50]) for (let y = 29; y < 78; y += 1) set(x, y, 70, 67, 62)
    } else {
      for (let y = 20; y < 67; y += 1) for (let x = 13; x < 51; x += 1) set(x, y, 75, 71, 65)
    }
  })
}

export function createTextureSet() {
  const walls = []
  walls[WALL.BRICK] = brick()
  walls[WALL.BOARDS] = boards()
  walls[WALL.CONCRETE] = concrete()
  walls[WALL.HOSPITAL] = hospital()
  walls[WALL.METAL] = metal()
  walls[WALL.FOREST] = forest()
  walls[WALL.GLASS] = glass()
  walls[WALL.WARNING] = warning()

  const floors = []
  floors[FLOOR.SOIL] = soil()
  floors[FLOOR.ASPHALT] = asphalt()
  floors[FLOOR.SIDEWALK] = sidewalk()
  floors[FLOOR.WOOD] = woodFloor()
  floors[FLOOR.CONCRETE] = concrete(131)
  floors[FLOOR.HOSPITAL] = hospital(141)
  floors[FLOOR.FOREST] = forestFloor()
  floors[FLOOR.VOID] = noisyBase(14, 14, 16, 3, 151)
  floors[FLOOR.ROAD_LINE] = roadLine()
  floors[FLOOR.DECK] = woodFloor(171)

  return {
    walls,
    floors,
    zombies: [zombieSprite(0), zombieSprite(1), zombieSprite(2)],
    plume: plumeSprite(),
    landmarks: new Map(),
    getLandmark(type) {
      if (!this.landmarks.has(type)) this.landmarks.set(type, landmarkSprite(type))
      return this.landmarks.get(type)
    },
  }
}
