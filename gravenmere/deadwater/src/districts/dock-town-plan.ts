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
 * Authored Dock Town road skeleton.
 *
 * These are intentionally stable connection points. Future districts should
 * meet the named exits rather than shifting Dock Town to make room.
 */
export const DOCK_TOWN_ROADS: PlannedRoad[] = [
  {
    id: 'harbor-road',
    label: 'Harbor Road',
    width: 9.4,
    sidewalks: false,
    points: points([-4, 126], [25, 127], [58, 126], [88, 125], [116, 122]),
  },
  {
    id: 'water-tower-curve',
    label: 'Water Tower Curve',
    width: 7.6,
    sidewalks: true,
    points: points([58, 88], [53, 96], [45, 107], [43, 117], [55, 125]),
  },
  {
    id: 'main-street',
    label: 'Main Street',
    width: 10.2,
    sidewalks: true,
    points: points([8, 79], [38, 80], [69, 79], [101, 78], [133, 75]),
  },
  {
    id: 'downtown-loop',
    label: 'Downtown Loop',
    width: 7.2,
    sidewalks: true,
    points: points([57, 81], [61, 96], [73, 106], [90, 103], [96, 91], [91, 79]),
  },
  {
    id: 'warehouse-lane',
    label: 'Warehouse Lane',
    width: 6.5,
    sidewalks: false,
    points: points([35, 80], [30, 90], [25, 101], [20, 114]),
  },
  {
    id: 'neighborhood-road',
    label: 'Neighborhood Road',
    width: 6.6,
    sidewalks: false,
    points: points([66, 79], [73, 68], [88, 59], [106, 60], [127, 70]),
  },
  {
    id: 'admin-road',
    label: 'Administration Road',
    width: 7.4,
    sidewalks: false,
    points: points([88, 124], [98, 114], [107, 102], [119, 91], [133, 82]),
  },
]

export const DOCK_TOWN_LIMITS = {
  minX: 4,
  maxX: 136,
  minZ: 46,
  maxZ: 130,
} as const

export const DOCK_TOWN_EXITS = {
  shipyard: new THREE.Vector2(-4, 126),
  harbor: new THREE.Vector2(116, 122),
  hospital: new THREE.Vector2(133, 75),
  outskirts: new THREE.Vector2(133, 82),
  farmAndTown: new THREE.Vector2(8, 79),
} as const

export const WATER_TOWER_POSITION = new THREE.Vector2(55, 101)
export const ADMIN_BUILDING_POSITION = new THREE.Vector2(95, 116)
export const TRANSMISSION_FIELD = {
  x: 116,
  z: 113,
  width: 31,
  depth: 28,
} as const
