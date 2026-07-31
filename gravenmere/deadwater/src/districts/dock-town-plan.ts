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
    points: points([-8, 72], [28, 72], [60, 72], [86, 72], [112, 72], [132, 72], [168, 72], [216, 72]),
  },
  {
    id: 'water-tower-avenue',
    label: 'Water Tower Avenue',
    width: 9.2,
    sidewalks: true,
    points: points([86, 5], [86, 35], [86, 72], [86, 108], [86, 136], [86, 166], [86, 188]),
  },
  {
    id: 'hospital-avenue',
    label: 'Hospital Avenue',
    width: 9.4,
    sidewalks: true,
    points: points([132, 72], [132, 106], [132, 136], [132, 166], [132, 188]),
  },
  {
    id: 'shopping-street',
    label: 'Shopping Street',
    width: 8.8,
    sidewalks: true,
    points: points([86, 136], [108, 136], [132, 136], [160, 136], [190, 136], [219, 136]),
  },
  {
    id: 'market-street',
    label: 'Market Street',
    width: 8.8,
    sidewalks: true,
    points: points([86, 166], [108, 166], [132, 166], [160, 166], [190, 166], [219, 166]),
  },
  {
    id: 'shipyard-road',
    label: 'Shipyard Road',
    width: 9.4,
    sidewalks: false,
    points: points([86, 122], [74, 132], [61, 146], [46, 162], [28, 178], [-8, 188]),
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
    points: points([53, 4], [53, 35], [53, 72]),
  },
  {
    id: 'neighborhood-cross',
    label: 'Foundry Lane',
    width: 7.0,
    sidewalks: true,
    points: points([3, 35], [20, 35], [53, 35], [86, 35]),
  },
  {
    id: 'hospital-drive',
    label: 'Emergency Drive',
    width: 6.8,
    sidewalks: false,
    points: points([143, 72], [148, 82], [170, 87], [196, 88]),
  },
]

export const DOCK_TOWN_LIMITS = {
  minX: -14,
  maxX: 222,
  minZ: 0,
  maxZ: 198,
} as const

export const DOCK_TOWN_BOUNDARY = points(
  [-10, 2],
  [216, 2],
  [222, 28],
  [222, 118],
  [219, 178],
  [194, 194],
  [112, 194],
  [66, 191],
  [26, 198],
  [-11, 190],
  [-14, 136],
  [-12, 68],
)

export const DOCK_TOWN_EXITS = {
  shipyardRoad: new THREE.Vector2(-8, 188),
  westMain: new THREE.Vector2(-8, 72),
  eastMain: new THREE.Vector2(216, 72),
  northMarket: new THREE.Vector2(219, 166),
} as const

export const IMPASSABLE_FOREST = {
  x: 161,
  z: 36,
  width: 112,
  depth: 68,
  polygon: points(
    [109, 5],
    [158, 3],
    [197, 8],
    [218, 19],
    [221, 38],
    [217, 55],
    [208, 67],
    [181, 69],
    [150, 67],
    [125, 61],
    [110, 49],
    [104, 29],
  ),
} as const

export const WATER_TOWER_POSITION = new THREE.Vector2(66, 108)
export const HOSPITAL_POSITION = new THREE.Vector2(176, 106)
export const HOSPITAL_FOOTPRINT = { width: 76, depth: 46 } as const
export const BAR_POSITION = new THREE.Vector2(112, 88)
export const FUEL_STATION_POSITION = new THREE.Vector2(105, 111)
export const FORGE_POSITION = new THREE.Vector2(54, 128)
export const PLAYER_START = new THREE.Vector2(92, 67)

export const FALLOUT_HILLS = {
  x: -52,
  z: 190,
  cloudX: -63,
  cloudZ: 217,
} as const
