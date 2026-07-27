export type SpaceKind =
  | 'gatehouse'
  | 'gallery'
  | 'cloister'
  | 'court'
  | 'hall'
  | 'library'
  | 'garden'
  | 'service'
  | 'stair'
  | 'tower'

export type Side = 'north' | 'south' | 'east' | 'west'

export interface SchoolSpace {
  id: string
  name: string
  kind: SpaceKind
  x: number
  z: number
  width: number
  depth: number
  height: number
  openSky?: boolean
  colorFamily: 'slate' | 'blue' | 'warm' | 'violet' | 'green'
}

export interface SchoolConnection {
  a: string
  b: string
  sideA: Side
  sideB: Side
  width: number
  vaulted?: boolean
}

export interface StairCore {
  id: string
  spaceId: string
  serves: readonly [0, 1, 2]
  enclosed: true
}

export interface SchoolPlan {
  entry: string
  spaces: readonly SchoolSpace[]
  connections: readonly SchoolConnection[]
  stairCores: readonly StairCore[]
}

const spaces = [
  {
    id: 'south-gatehouse',
    name: 'South Gatehouse',
    kind: 'gatehouse',
    x: 0,
    z: 112,
    width: 22,
    depth: 18,
    height: 8.5,
    colorFamily: 'slate',
  },
  {
    id: 'processional-gallery',
    name: 'Processional Gallery',
    kind: 'gallery',
    x: 0,
    z: 91,
    width: 18,
    depth: 24,
    height: 7.4,
    colorFamily: 'blue',
  },
  {
    id: 'south-cloister',
    name: 'South Cloister',
    kind: 'cloister',
    x: 0,
    z: 70,
    width: 62,
    depth: 10,
    height: 6.8,
    colorFamily: 'slate',
  },
  {
    id: 'west-cloister',
    name: 'West Cloister',
    kind: 'cloister',
    x: -26,
    z: 48,
    width: 10,
    depth: 54,
    height: 6.8,
    colorFamily: 'violet',
  },
  {
    id: 'east-cloister',
    name: 'East Cloister',
    kind: 'cloister',
    x: 26,
    z: 48,
    width: 10,
    depth: 54,
    height: 6.8,
    colorFamily: 'warm',
  },
  {
    id: 'north-cloister',
    name: 'North Cloister',
    kind: 'cloister',
    x: 0,
    z: 26,
    width: 62,
    depth: 10,
    height: 6.8,
    colorFamily: 'blue',
  },
  {
    id: 'founders-court',
    name: "Founders' Court",
    kind: 'court',
    x: 0,
    z: 48,
    width: 40,
    depth: 34,
    height: 0,
    openSky: true,
    colorFamily: 'green',
  },
  {
    id: 'library-range',
    name: 'Library Range',
    kind: 'library',
    x: -48,
    z: 48,
    width: 32,
    depth: 44,
    height: 8.2,
    colorFamily: 'violet',
  },
  {
    id: 'great-hall-range',
    name: 'Great Hall Range',
    kind: 'hall',
    x: 48,
    z: 48,
    width: 32,
    depth: 44,
    height: 9.4,
    colorFamily: 'warm',
  },
  {
    id: 'west-service-passage',
    name: 'West Service Passage',
    kind: 'service',
    x: -48,
    z: 76,
    width: 16,
    depth: 10,
    height: 5.8,
    colorFamily: 'slate',
  },
  {
    id: 'east-service-passage',
    name: 'East Service Passage',
    kind: 'service',
    x: 48,
    z: 76,
    width: 16,
    depth: 10,
    height: 5.8,
    colorFamily: 'slate',
  },
  {
    id: 'winter-court',
    name: 'Winter Court',
    kind: 'garden',
    x: -48,
    z: 94,
    width: 32,
    depth: 26,
    height: 0,
    openSky: true,
    colorFamily: 'green',
  },
  {
    id: 'lantern-court',
    name: 'Lantern Court',
    kind: 'garden',
    x: 48,
    z: 94,
    width: 32,
    depth: 26,
    height: 0,
    openSky: true,
    colorFamily: 'green',
  },
  {
    id: 'west-stair-tower',
    name: 'West Stair Tower',
    kind: 'stair',
    x: -31,
    z: 75,
    width: 10,
    depth: 10,
    height: 13,
    colorFamily: 'violet',
  },
  {
    id: 'east-stair-tower',
    name: 'East Stair Tower',
    kind: 'stair',
    x: 31,
    z: 75,
    width: 10,
    depth: 10,
    height: 13,
    colorFamily: 'warm',
  },
  {
    id: 'north-academic-spine',
    name: 'North Academic Spine',
    kind: 'gallery',
    x: 0,
    z: 8,
    width: 18,
    depth: 26,
    height: 7.6,
    colorFamily: 'blue',
  },
  {
    id: 'west-tower',
    name: 'West Tower',
    kind: 'tower',
    x: -34,
    z: 20,
    width: 12,
    depth: 12,
    height: 15,
    colorFamily: 'violet',
  },
  {
    id: 'east-tower',
    name: 'East Tower',
    kind: 'tower',
    x: 34,
    z: 20,
    width: 12,
    depth: 12,
    height: 15,
    colorFamily: 'warm',
  },
] as const satisfies readonly SchoolSpace[]

const connections = [
  { a: 'south-gatehouse', b: 'processional-gallery', sideA: 'north', sideB: 'south', width: 7, vaulted: true },
  { a: 'processional-gallery', b: 'south-cloister', sideA: 'north', sideB: 'south', width: 7, vaulted: true },
  { a: 'south-cloister', b: 'west-cloister', sideA: 'west', sideB: 'south', width: 6, vaulted: true },
  { a: 'south-cloister', b: 'east-cloister', sideA: 'east', sideB: 'south', width: 6, vaulted: true },
  { a: 'west-cloister', b: 'north-cloister', sideA: 'north', sideB: 'west', width: 6, vaulted: true },
  { a: 'east-cloister', b: 'north-cloister', sideA: 'north', sideB: 'east', width: 6, vaulted: true },
  { a: 'west-cloister', b: 'library-range', sideA: 'west', sideB: 'east', width: 7, vaulted: true },
  { a: 'east-cloister', b: 'great-hall-range', sideA: 'east', sideB: 'west', width: 7, vaulted: true },
  { a: 'library-range', b: 'west-service-passage', sideA: 'south', sideB: 'north', width: 5 },
  { a: 'great-hall-range', b: 'east-service-passage', sideA: 'south', sideB: 'north', width: 5 },
  { a: 'west-service-passage', b: 'winter-court', sideA: 'south', sideB: 'north', width: 6, vaulted: true },
  { a: 'east-service-passage', b: 'lantern-court', sideA: 'south', sideB: 'north', width: 6, vaulted: true },
  { a: 'south-cloister', b: 'west-stair-tower', sideA: 'west', sideB: 'east', width: 4 },
  { a: 'south-cloister', b: 'east-stair-tower', sideA: 'east', sideB: 'west', width: 4 },
  { a: 'north-cloister', b: 'north-academic-spine', sideA: 'north', sideB: 'south', width: 7, vaulted: true },
  { a: 'north-cloister', b: 'west-tower', sideA: 'west', sideB: 'east', width: 4 },
  { a: 'north-cloister', b: 'east-tower', sideA: 'east', sideB: 'west', width: 4 },
] as const satisfies readonly SchoolConnection[]

export const schoolPlan: SchoolPlan = {
  entry: 'south-gatehouse',
  spaces,
  connections,
  stairCores: [
    { id: 'west-main-stair', spaceId: 'west-stair-tower', serves: [0, 1, 2], enclosed: true },
    { id: 'east-main-stair', spaceId: 'east-stair-tower', serves: [0, 1, 2], enclosed: true },
  ],
}

export function reachableSpaceIds(plan: SchoolPlan): Set<string> {
  const visited = new Set<string>([plan.entry])
  const queue = [plan.entry]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const connection of plan.connections) {
      const next = connection.a === current ? connection.b : connection.b === current ? connection.a : null
      if (next && !visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return visited
}
