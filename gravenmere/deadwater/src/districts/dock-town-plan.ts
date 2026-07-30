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
 *
 * The impassable forest is deliberately inside the district rather than along
 * its outer boundary. Harbor Road, Warehouse Lane, Main Street and Water Tower
 * Curve wrap around it, forcing a real road journey between Dock Town and the
 * shipyard instead of allowing a straight cross-country walk.
 */
export const DOCK_TOWN_ROADS: PlannedRoad[] = [
  {
    id: 'harbor-road',
    label: 'Harbor Road',
    width: 9.4,
    sidewalks: false,
    points: points([-8, 132], [8, 134], [24, 136], [42, 136], [60, 132], [82, 127], [102, 125], [120, 124]),
  },
  {
    id: 'water-tower-curve',
    label: 'Water Tower Curve',
    width: 7.6,
    sidewalks: true,
    points: points([63, 84], [66, 94], [66, 105], [68, 116], [75, 126]),
  },
  {
    id: 'main-street',
    label: 'Main Street',
    width: 10.2,
    sidewalks: true,
    points: points([8, 78], [24, 76], [43, 76], [64, 79], [93, 78], [134, 75]),
  },
  {
    id: 'downtown-loop',
    label: 'Downtown Loop',
    width: 7.2,
    sidewalks: true,
    points: points([62, 80], [69, 88], [74, 99], [84, 107], [98, 102], [103, 90], [94, 79]),
  },
  {
    id: 'warehouse-lane',
    label: 'Warehouse Lane',
    width: 6.5,
    sidewalks: false,
    points: points([20, 77], [14, 88], [10, 101], [12, 114], [20, 126], [27, 135]),
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
    points: points([92, 124], [101, 115], [109, 104], [120, 91], [134, 82]),
  },
]

export const DOCK_TOWN_LIMITS = {
  minX: -8,
  maxX: 140,
  minZ: 44,
  maxZ: 138,
} as const

export const DOCK_TOWN_EXITS = {
  shipyard: new THREE.Vector2(-8, 132),
  harbor: new THREE.Vector2(120, 124),
  hospital: new THREE.Vector2(134, 75),
  outskirts: new THREE.Vector2(134, 82),
  farmAndTown: new THREE.Vector2(8, 78),
} as const

export const IMPASSABLE_FOREST = {
  x: 40,
  z: 106,
  width: 58,
  depth: 58,
  // An intentionally irregular landmass filling most of the interior between
  // the four surrounding roads. This is not an ellipse or a decorative edge.
  polygon: points(
    [21, 84],
    [37, 81],
    [53, 83],
    [63, 91],
    [66, 104],
    [62, 114],
    [69, 124],
    [58, 131],
    [42, 134],
    [27, 130],
    [18, 121],
    [15, 108],
    [18, 96],
  ),
} as const

export const WATER_TOWER_POSITION = new THREE.Vector2(67, 106)
export const ADMIN_BUILDING_POSITION = new THREE.Vector2(98, 116)
export const TRANSMISSION_FIELD = {
  x: 120,
  z: 113,
  width: 31,
  depth: 28,
} as const
