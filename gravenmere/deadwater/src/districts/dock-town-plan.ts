import * as THREE from 'three'

export type PlannedRoad = {
  id: string
  label: string
  width: number
  sidewalks: boolean
  points: THREE.Vector2[]
}

const points = (...coordinates: Array<[number, number]>): THREE.Vector2[] => (
  coordinates.map(([x, z]) => new THREE.Vector2(x, z))
)

/**
 * Town map reconstructed from the hand-drawn block plan.
 *
 * X runs west to east and Z runs south to north. The roads below are full
 * paved streets, not paths. Their control points are kept as stable map seams
 * so the future Shipyard can meet Shipyard Road without being loaded here.
 */
export const DOCK_TOWN_ROADS: PlannedRoad[] = [
  {
    id: 'main-street',
    label: 'Main Street',
    width: 10.8,
    sidewalks: true,
    points: points([-7, 72], [24, 72], [54, 72], [82, 72], [106, 72], [132, 72], [178, 72]),
  },
  {
    id: 'water-tower-avenue',
    label: 'Water Tower Avenue',
    width: 9.2,
    sidewalks: true,
    points: points([82, 5], [82, 34], [82, 72], [82, 103], [82, 136], [82, 159]),
  },
  {
    id: 'hospital-avenue',
    label: 'Hospital Avenue',
    width: 9.4,
    sidewalks: true,
    points: points([124, 72], [124, 92], [124, 112], [124, 136], [124, 159]),
  },
  {
    id: 'shopping-street',
    label: 'Shopping Street',
    width: 8.8,
    sidewalks: true,
    points: points([82, 112], [104, 112], [124, 112], [150, 112], [180, 112]),
  },
  {
    id: 'market-street',
    label: 'Market Street',
    width: 8.8,
    sidewalks: true,
    points: points([82, 136], [104, 136], [124, 136], [150, 136], [180, 136]),
  },
  {
    id: 'shipyard-road',
    label: 'Shipyard Road',
    width: 9.4,
    sidewalks: false,
    points: points([82, 104], [70, 111], [59, 123], [46, 137], [28, 149], [-7, 157]),
  },
  {
    id: 'neighborhood-west',
    label: 'Willow Street',
    width: 7.2,
    sidewalks: true,
    points: points([20, 4], [20, 34], [20, 72]),
  },
  {
    id: 'neighborhood-center',
    label: 'Ash Street',
    width: 7.2,
    sidewalks: true,
    points: points([50, 4], [50, 34], [50, 72]),
  },
  {
    id: 'neighborhood-cross',
    label: 'Foundry Lane',
    width: 7.0,
    sidewalks: true,
    points: points([3, 34], [20, 34], [50, 34], [82, 34]),
  },
  {
    id: 'hospital-drive',
    label: 'Emergency Drive',
    width: 6.8,
    sidewalks: false,
    points: points([134, 72], [138, 84], [148, 96], [168, 101]),
  },
]

export const DOCK_TOWN_LIMITS = {
  minX: -12,
  maxX: 184,
  minZ: 0,
  maxZ: 166,
} as const

export const DOCK_TOWN_BOUNDARY = points(
  [-8, 2],
  [178, 2],
  [184, 25],
  [184, 96],
  [181, 148],
  [151, 163],
  [91, 163],
  [58, 160],
  [24, 169],
  [-10, 159],
  [-12, 119],
  [-10, 66],
)

export const DOCK_TOWN_EXITS = {
  shipyardRoad: new THREE.Vector2(-7, 157),
  westMain: new THREE.Vector2(-7, 72),
  eastMain: new THREE.Vector2(178, 72),
  northMarket: new THREE.Vector2(180, 136),
} as const

export const IMPASSABLE_FOREST = {
  x: 147,
  z: 35,
  width: 76,
  depth: 65,
  polygon: points(
    [106, 5],
    [147, 3],
    [177, 11],
    [183, 29],
    [181, 49],
    [174, 64],
    [154, 68],
    [132, 64],
    [113, 57],
    [105, 39],
  ),
} as const

export const WATER_TOWER_POSITION = new THREE.Vector2(61, 100)
export const HOSPITAL_POSITION = new THREE.Vector2(151, 92)
export const BAR_POSITION = new THREE.Vector2(108, 84)
export const FUEL_STATION_POSITION = new THREE.Vector2(101, 99)
export const PLAYER_START = new THREE.Vector2(87, 67)

export const FALLOUT_HILLS = {
  x: -46,
  z: 166,
  cloudX: -56,
  cloudZ: 184,
} as const
