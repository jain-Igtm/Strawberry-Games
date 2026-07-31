export const ORIGIN_X = -16
export const ORIGIN_Z = -2
export const GRID_WIDTH = 242
export const GRID_HEIGHT = 204

export const WALL = Object.freeze({
  EMPTY: 0,
  BRICK: 1,
  BOARDS: 2,
  CONCRETE: 3,
  HOSPITAL: 4,
  METAL: 5,
  FOREST: 6,
  GLASS: 7,
  WARNING: 8,
})

export const FLOOR = Object.freeze({
  SOIL: 0,
  ASPHALT: 1,
  SIDEWALK: 2,
  WOOD: 3,
  CONCRETE: 4,
  HOSPITAL: 5,
  FOREST: 6,
  VOID: 7,
  ROAD_LINE: 8,
  DECK: 9,
})

export const ROADS = [
  { id: 'main-street', width: 10.8, sidewalks: true, points: [[-8, 72], [28, 72], [60, 72], [86, 72], [112, 72], [132, 72], [168, 72], [216, 72]] },
  { id: 'water-tower-avenue', width: 9.2, sidewalks: true, points: [[86, 5], [86, 35], [86, 72], [86, 108], [86, 136], [86, 166], [86, 188]] },
  { id: 'hospital-avenue', width: 9.4, sidewalks: true, points: [[132, 72], [132, 106], [132, 136], [132, 166], [132, 188]] },
  { id: 'shopping-street', width: 8.8, sidewalks: true, points: [[86, 136], [108, 136], [132, 136], [160, 136], [190, 136], [219, 136]] },
  { id: 'market-street', width: 8.8, sidewalks: true, points: [[86, 166], [108, 166], [132, 166], [160, 166], [190, 166], [219, 166]] },
  { id: 'shipyard-road', width: 9.4, sidewalks: false, points: [[86, 122], [74, 132], [61, 146], [46, 162], [28, 178], [-8, 188]] },
  { id: 'willow-street', width: 7.2, sidewalks: true, points: [[20, 4], [20, 34], [20, 72]] },
  { id: 'ash-street', width: 7.2, sidewalks: true, points: [[53, 4], [53, 35], [53, 72]] },
  { id: 'foundry-lane', width: 7.0, sidewalks: true, points: [[3, 35], [20, 35], [53, 35], [86, 35]] },
  { id: 'emergency-drive', width: 6.8, sidewalks: false, points: [[143, 72], [148, 82], [170, 87], [196, 88]] },
]

export const PLAYER_START = Object.freeze({ x: 92, z: 67, angle: 0.03 })
export const HOSPITAL = Object.freeze({ x: 176, z: 106, width: 76, depth: 46 })
export const BAR = Object.freeze({ x: 112, z: 88, width: 16, depth: 16 })
export const FOREST_POLYGON = [
  [109, 5], [158, 3], [197, 8], [218, 19], [221, 38], [217, 55],
  [208, 67], [181, 69], [150, 67], [125, 61], [110, 49], [104, 29],
]

const BUILDING_FOOTPRINTS = []

function indexOfCell(x, z) {
  const gx = Math.floor(x - ORIGIN_X)
  const gz = Math.floor(z - ORIGIN_Z)
  if (gx < 0 || gz < 0 || gx >= GRID_WIDTH || gz >= GRID_HEIGHT) return -1
  return gz * GRID_WIDTH + gx
}

function pointInPolygon(x, z, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i]
    const [xj, zj] = polygon[j]
    const intersects = ((zi > z) !== (zj > z)) &&
      (x < ((xj - xi) * (z - zi)) / ((zj - zi) || Number.EPSILON) + xi)
    if (intersects) inside = !inside
  }
  return inside
}

function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax
  const dz = bz - az
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared === 0) return Math.hypot(px - ax, pz - az)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSquared))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

function roadFloorAt(x, z) {
  let sidewalk = false
  for (const road of ROADS) {
    for (let i = 0; i < road.points.length - 1; i += 1) {
      const [ax, az] = road.points[i]
      const [bx, bz] = road.points[i + 1]
      const distance = distanceToSegment(x, z, ax, az, bx, bz)
      if (distance <= 0.62 && road.width >= 8.0) return FLOOR.ROAD_LINE
      if (distance <= road.width * 0.5) return FLOOR.ASPHALT
      if (road.sidewalks && distance <= road.width * 0.5 + 1.6) sidewalk = true
    }
  }
  return sidewalk ? FLOOR.SIDEWALK : FLOOR.SOIL
}

function fillRect(array, x, z, width, depth, value) {
  const minX = Math.floor(x - width * 0.5)
  const maxX = Math.ceil(x + width * 0.5)
  const minZ = Math.floor(z - depth * 0.5)
  const maxZ = Math.ceil(z + depth * 0.5)
  for (let wz = minZ; wz <= maxZ; wz += 1) {
    for (let wx = minX; wx <= maxX; wx += 1) {
      const index = indexOfCell(wx + 0.5, wz + 0.5)
      if (index >= 0) array[index] = value
    }
  }
}

function clearRect(array, x, z, width, depth) {
  fillRect(array, x, z, width, depth, 0)
}

function setCell(world, level, x, z, wallType, height = 1) {
  const index = indexOfCell(x, z)
  if (index < 0) return
  world.levels[level].walls[index] = wallType
  world.levels[level].heights[index] = Math.max(1, Math.min(255, Math.round(height * 64)))
}

function setRect(world, level, x, z, width, depth, wallType, height = 1) {
  const minX = Math.floor(x - width * 0.5)
  const maxX = Math.ceil(x + width * 0.5)
  const minZ = Math.floor(z - depth * 0.5)
  const maxZ = Math.ceil(z + depth * 0.5)
  for (let wz = minZ; wz <= maxZ; wz += 1) {
    for (let wx = minX; wx <= maxX; wx += 1) setCell(world, level, wx + 0.5, wz + 0.5, wallType, height)
  }
}

function clearWorldRect(world, level, x, z, width, depth) {
  const minX = Math.floor(x - width * 0.5)
  const maxX = Math.ceil(x + width * 0.5)
  const minZ = Math.floor(z - depth * 0.5)
  const maxZ = Math.ceil(z + depth * 0.5)
  for (let wz = minZ; wz <= maxZ; wz += 1) {
    for (let wx = minX; wx <= maxX; wx += 1) {
      const index = indexOfCell(wx + 0.5, wz + 0.5)
      if (index >= 0) world.levels[level].walls[index] = WALL.EMPTY
    }
  }
}

function setHorizontal(world, level, x1, x2, z, wallType, height = 1, gaps = []) {
  const minX = Math.floor(Math.min(x1, x2))
  const maxX = Math.ceil(Math.max(x1, x2))
  for (let x = minX; x <= maxX; x += 1) {
    const inGap = gaps.some(([center, width]) => Math.abs((x + 0.5) - center) <= width * 0.5)
    if (!inGap) setCell(world, level, x + 0.5, z + 0.5, wallType, height)
  }
}

function setVertical(world, level, x, z1, z2, wallType, height = 1, gaps = []) {
  const minZ = Math.floor(Math.min(z1, z2))
  const maxZ = Math.ceil(Math.max(z1, z2))
  for (let z = minZ; z <= maxZ; z += 1) {
    const inGap = gaps.some(([center, width]) => Math.abs((z + 0.5) - center) <= width * 0.5)
    if (!inGap) setCell(world, level, x + 0.5, z + 0.5, wallType, height)
  }
}

function addShell(world, {
  x, z, width, depth, wall = WALL.BRICK, height = 1, floor = FLOOR.CONCRETE,
  southDoors = [], northDoors = [], westDoors = [], eastDoors = [], level = 0,
}) {
  const minX = x - width * 0.5
  const maxX = x + width * 0.5
  const minZ = z - depth * 0.5
  const maxZ = z + depth * 0.5
  setHorizontal(world, level, minX, maxX, minZ, wall, height, southDoors)
  setHorizontal(world, level, minX, maxX, maxZ, wall, height, northDoors)
  setVertical(world, level, minX, minZ, maxZ, wall, height, westDoors)
  setVertical(world, level, maxX, minZ, maxZ, wall, height, eastDoors)
  fillRect(world.levels[level].floors, x, z, width - 1, depth - 1, floor)
  if (level === 0) BUILDING_FOOTPRINTS.push({ x, z, width, depth, floor })
}

function addEnterableBuilding(world, x, z, width, depth, wall, floor = FLOOR.CONCRETE, doorWidth = 2.4) {
  addShell(world, { x, z, width, depth, wall, floor, southDoors: [[x, doorWidth]], height: 1.05 })
  setHorizontal(world, 0, x - width * 0.5 + 1, x + width * 0.5 - 1, z + 0.8, wall, 1.0, [[x, 2.0]])
}

function addClosedBuilding(world, x, z, width, depth, wall, height = 1.45) {
  setRect(world, 0, x, z, width, depth, wall, height)
  BUILDING_FOOTPRINTS.push({ x, z, width, depth, floor: FLOOR.VOID })
}

function addNeighborhood(world) {
  const houses = [
    [7, 13, 1], [38, 13, 2], [71, 13, 1],
    [7, 25, 2], [38, 25, 1], [71, 25, 2],
    [7, 48, 2], [38, 48, 1], [71, 48, 2],
    [7, 60, 1], [38, 60, 2], [71, 60, 1],
  ]
  for (const [x, z, floors] of houses) {
    addEnterableBuilding(world, x, z, 8.4, 8.2, WALL.BOARDS, FLOOR.WOOD, 2.1)
    const partitionZ = z + 0.7
    setHorizontal(world, 0, x - 3.2, x + 3.2, partitionZ, WALL.BOARDS, 1.0, [[x, 1.5]])
    if (floors > 1) world.landmarks.push({ type: 'upper-windows', x, z, scale: 0.7 })
  }
}

function addTowerBlock(world) {
  addClosedBuilding(world, 48, 91, 14, 13, WALL.BRICK, 2.0)
  addClosedBuilding(world, 66, 91, 14, 12, WALL.CONCRETE, 2.35)
  addClosedBuilding(world, 96, 91, 9, 13, WALL.BOARDS, 1.75)
  setRect(world, 0, 66, 108, 5, 5, WALL.METAL, 1.3)
  world.landmarks.push({ type: 'water-tower', x: 66, z: 108, scale: 1.8 })
}

function addBar(world) {
  addShell(world, {
    x: BAR.x, z: BAR.z, width: BAR.width, depth: BAR.depth,
    wall: WALL.BRICK, floor: FLOOR.WOOD, southDoors: [[BAR.x, 3]], height: 1.35,
  })
  setHorizontal(world, 0, 106, 117, 92.5, WALL.BOARDS, 1, [[108.2, 1.6]])
  setVertical(world, 0, 116.5, 82, 92, WALL.BOARDS, 1, [[87, 1.8]])
  setRect(world, 0, 108, 92, 2.2, 2.2, WALL.METAL, 0.7)

  const level = 1
  fillRect(world.levels[level].floors, BAR.x, BAR.z - 1.4, 15, 12, FLOOR.WOOD)
  addShell(world, {
    x: BAR.x, z: BAR.z, width: BAR.width, depth: BAR.depth,
    wall: WALL.BRICK, floor: FLOOR.WOOD, southDoors: [[BAR.x, 3.2]], level, height: 1.2,
  })
  clearWorldRect(world, level, BAR.x, BAR.z - BAR.depth * 0.5, 3.2, 2.2)
  fillRect(world.levels[level].floors, BAR.x, BAR.z - BAR.depth * 0.5 - 3, 12, 6, FLOOR.DECK)
  setHorizontal(world, level, BAR.x - 6, BAR.x + 6, BAR.z - BAR.depth * 0.5 - 6, WALL.METAL, 0.55, [[BAR.x, 2]])
  setVertical(world, level, BAR.x - 6, BAR.z - BAR.depth * 0.5 - 6, BAR.z - BAR.depth * 0.5, WALL.METAL, 0.55)
  setVertical(world, level, BAR.x + 6, BAR.z - BAR.depth * 0.5 - 6, BAR.z - BAR.depth * 0.5, WALL.METAL, 0.55)
  world.interactions.push({ level: 0, x: 112, z: 90, radius: 2.2, label: 'CLIMB TO BAR BALCONY', targetLevel: 1, targetX: 108.7, targetZ: 91.2 })
  world.interactions.push({ level: 1, x: 108.7, z: 91.2, radius: 1.8, label: 'GO DOWNSTAIRS', targetLevel: 0, targetX: 112, targetZ: 90 })
}

function addGasStation(world) {
  addEnterableBuilding(world, 105, 111, 12, 9, WALL.CONCRETE, FLOOR.CONCRETE, 2.6)
  setRect(world, 0, 100, 101, 1.2, 1.2, WALL.METAL, 0.8)
  setRect(world, 0, 110, 101, 1.2, 1.2, WALL.METAL, 0.8)
  world.landmarks.push({ type: 'canopy', x: 105, z: 101, scale: 1.1 })
}

function addHospital(world) {
  const { x, z, width, depth } = HOSPITAL
  addShell(world, {
    x, z, width, depth, wall: WALL.HOSPITAL, floor: FLOOR.HOSPITAL, height: 1.3,
    southDoors: [[176, 5.0], [194, 3.0]], eastDoors: [[106, 4.0]], westDoors: [[106, 3.0]],
  })

  const minX = x - width * 0.5 + 1
  const maxX = x + width * 0.5 - 1
  const minZ = z - depth * 0.5 + 1
  const maxZ = z + depth * 0.5 - 1
  setHorizontal(world, 0, minX, maxX, 102.5, WALL.HOSPITAL, 1.05,
    [[145, 2.3], [154, 2.3], [163, 2.3], [176, 4.2], [188, 2.3], [197, 2.3], [206, 2.3]])
  setHorizontal(world, 0, minX, maxX, 109.5, WALL.HOSPITAL, 1.05,
    [[145, 2.3], [154, 2.3], [163, 2.3], [176, 4.2], [188, 2.3], [197, 2.3], [206, 2.3]])

  for (const roomX of [149, 158, 167, 185, 194, 203]) {
    setVertical(world, 0, roomX, minZ, 102.5, WALL.HOSPITAL, 1.05, [[94, 1.6]])
    setVertical(world, 0, roomX, 109.5, maxZ, WALL.HOSPITAL, 1.05, [[118, 1.6]])
  }

  setVertical(world, 0, 173.5, minZ, maxZ, WALL.HOSPITAL, 1.05,
    [[88, 2.6], [106, 7.0], [123, 2.6]])
  setVertical(world, 0, 178.5, minZ, maxZ, WALL.HOSPITAL, 1.05,
    [[88, 2.6], [106, 7.0], [123, 2.6]])

  setRect(world, 0, 181.5, 98, 5, 1, WALL.CONCRETE, 0.65)
  setRect(world, 0, 183.5, 114, 1, 6, WALL.GLASS, 0.85)
  setRect(world, 0, 194, 88, 6, 2, WALL.METAL, 0.7)
  world.landmarks.push({ type: 'hospital-sign', x: 176, z: 82.4, scale: 1.2 })
}

function addFactoriesAndForge(world) {
  addEnterableBuilding(world, 21, 148, 18, 15, WALL.METAL, FLOOR.CONCRETE, 3.2)
  addEnterableBuilding(world, 54, 127, 18, 14, WALL.BRICK, FLOOR.CONCRETE, 3.2)
  setRect(world, 0, 54, 139, 4, 4, WALL.WARNING, 0.9)
  world.landmarks.push({ type: 'forge', x: 54, z: 139, scale: 0.9 })
}

function addShoppingDistrict(world) {
  addClosedBuilding(world, 147, 150, 14, 11, WALL.BRICK, 1.65)
  addEnterableBuilding(world, 166, 150, 15, 11, WALL.BOARDS, FLOOR.WOOD, 2.6)
  addEnterableBuilding(world, 196, 150, 17, 11, WALL.CONCRETE, FLOOR.CONCRETE, 2.8)
  addClosedBuilding(world, 147, 181, 14, 13, WALL.CONCRETE, 1.9)
  addClosedBuilding(world, 166, 181, 15, 13, WALL.BRICK, 1.65)
  addEnterableBuilding(world, 196, 181, 17, 13, WALL.BOARDS, FLOOR.WOOD, 2.8)
}

function addForest(world) {
  for (let z = 1; z < 72; z += 1) {
    for (let x = 102; x < 223; x += 1) {
      if (!pointInPolygon(x + 0.5, z + 0.5, FOREST_POLYGON)) continue
      const index = indexOfCell(x + 0.5, z + 0.5)
      if (index < 0) continue
      world.levels[0].floors[index] = FLOOR.FOREST
      const edge = [
        pointInPolygon(x - 0.5, z + 0.5, FOREST_POLYGON),
        pointInPolygon(x + 1.5, z + 0.5, FOREST_POLYGON),
        pointInPolygon(x + 0.5, z - 0.5, FOREST_POLYGON),
        pointInPolygon(x + 0.5, z + 1.5, FOREST_POLYGON),
      ].some((inside) => !inside)
      if (edge || ((x * 17 + z * 31) % 13 === 0)) setCell(world, 0, x + 0.5, z + 0.5, WALL.FOREST, 1.65)
    }
  }
}

function addBoundaryBarricades(world) {
  setRect(world, 0, -7, 188, 9, 2, WALL.WARNING, 0.9)
  setRect(world, 0, -8, 72, 2, 12, WALL.WARNING, 0.9)
  setRect(world, 0, 216, 72, 2, 12, WALL.WARNING, 0.9)
  setRect(world, 0, 219, 136, 2, 10, WALL.WARNING, 0.9)
  setRect(world, 0, 219, 166, 2, 10, WALL.WARNING, 0.9)
}

function addWorldBounds(world) {
  setRect(world, 0, -15, 99, 1, 202, WALL.FOREST, 1.8)
  setRect(world, 0, 222, 99, 1, 202, WALL.FOREST, 1.8)
  setRect(world, 0, 104, -1, 240, 1, WALL.FOREST, 1.8)
  setRect(world, 0, 104, 199, 240, 1, WALL.FOREST, 1.8)
}

function precomputeFloors(world) {
  for (let z = 0; z < GRID_HEIGHT; z += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const worldX = x + ORIGIN_X + 0.5
      const worldZ = z + ORIGIN_Z + 0.5
      world.levels[0].floors[z * GRID_WIDTH + x] = roadFloorAt(worldX, worldZ)
      world.levels[1].floors[z * GRID_WIDTH + x] = FLOOR.VOID
    }
  }
}

function addSpawns(world) {
  const coordinates = [
    [112, 63], [130, 66], [149, 67], [169, 68], [190, 67], [210, 63],
    [148, 106], [176, 106], [202, 106], [176, 124], [216, 96], [216, 142],
    [209, 181], [181, 190], [140, 190], [101, 190], [66, 187], [32, 192],
    [1, 182], [-7, 139], [-5, 80], [3, 49], [5, 14], [43, 6], [78, 6],
  ]
  world.spawnPoints = coordinates
    .filter(([x, z]) => !world.isBlocked(x, z, 0))
    .map(([x, z]) => ({ x, z }))
}

export function buildWorld() {
  BUILDING_FOOTPRINTS.length = 0
  const makeLevel = () => ({
    walls: new Uint8Array(GRID_WIDTH * GRID_HEIGHT),
    heights: new Uint8Array(GRID_WIDTH * GRID_HEIGHT),
    floors: new Uint8Array(GRID_WIDTH * GRID_HEIGHT),
  })
  const world = {
    levels: [makeLevel(), makeLevel()],
    spawnPoints: [],
    interactions: [],
    landmarks: [],
    indexOfCell,
    cellAt(x, z, level = 0) {
      const index = indexOfCell(x, z)
      if (index < 0) return { wall: WALL.FOREST, height: 1.8, floor: FLOOR.VOID }
      const layer = this.levels[level]
      return {
        wall: layer.walls[index],
        height: (layer.heights[index] || 64) / 64,
        floor: layer.floors[index],
      }
    },
    isBlocked(x, z, level = 0) {
      const index = indexOfCell(x, z)
      if (index < 0) return true
      const layer = this.levels[level]
      if (level > 0 && layer.floors[index] === FLOOR.VOID) return true
      return layer.walls[index] !== WALL.EMPTY
    },
    canStand(x, z, radius = 0.28, level = 0) {
      const offsets = [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius], [0, 0]]
      return offsets.every(([ox, oz]) => !this.isBlocked(x + ox, z + oz, level))
    },
    floorAt(x, z, level = 0) {
      const index = indexOfCell(x, z)
      if (index < 0) return FLOOR.VOID
      return this.levels[level].floors[index]
    },
    interactionAt(x, z, level = 0) {
      return this.interactions.find((item) => item.level === level && Math.hypot(x - item.x, z - item.z) <= item.radius) ?? null
    },
  }

  precomputeFloors(world)
  addWorldBounds(world)
  addNeighborhood(world)
  addTowerBlock(world)
  addBar(world)
  addGasStation(world)
  addHospital(world)
  addFactoriesAndForge(world)
  addShoppingDistrict(world)
  addForest(world)
  addBoundaryBarricades(world)
  addSpawns(world)

  world.landmarks.push({ type: 'plume', x: -63, z: 217, scale: 6.8, vertical: 1.45 })
  world.landmarks.push({ type: 'vehicle', x: 101, z: 67, scale: 0.8 })
  world.landmarks.push({ type: 'vehicle', x: 65, z: 43, scale: 0.75 })
  return world
}

export function mapMetadata() {
  return {
    roads: ROADS.length,
    hospital: HOSPITAL,
    bar: BAR,
    playerStart: PLAYER_START,
    forestVertices: FOREST_POLYGON.length,
  }
}
