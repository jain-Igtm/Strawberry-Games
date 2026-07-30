export type WeaponId =
  | 'carbine'
  | 'smg'
  | 'shotgun'
  | 'marksman'
  | 'lmg'
  | 'harpoon'
  | 'arc'

export type WeaponDefinition = {
  id: WeaponId
  name: string
  magazineSize: number
  startingReserve: number
  fireDelay: number
  reloadTime: number
  damage: number
  headshotMultiplier: number
  pellets: number
  spread: number
  automatic: boolean
  viewScale: [number, number, number]
  viewPosition: [number, number, number]
  accent: number
  scopeFov?: number
  special?: boolean
}

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  carbine: {
    id: 'carbine',
    name: 'RUSTLINE CARBINE',
    magazineSize: 30,
    startingReserve: 180,
    fireDelay: 0.105,
    reloadTime: 1.65,
    damage: 36,
    headshotMultiplier: 1.9,
    pellets: 1,
    spread: 0.0025,
    automatic: true,
    viewScale: [1, 1, 1],
    viewPosition: [0.34, -0.29, -0.61],
    accent: 0xa85a2a,
  },
  smg: {
    id: 'smg',
    name: 'CINDER-9 SMG',
    magazineSize: 42,
    startingReserve: 252,
    fireDelay: 0.072,
    reloadTime: 1.42,
    damage: 23,
    headshotMultiplier: 1.65,
    pellets: 1,
    spread: 0.0075,
    automatic: true,
    viewScale: [0.86, 0.92, 0.8],
    viewPosition: [0.36, -0.3, -0.5],
    accent: 0xd17b2c,
  },
  shotgun: {
    id: 'shotgun',
    name: 'BREAKWATER 12',
    magazineSize: 8,
    startingReserve: 56,
    fireDelay: 0.68,
    reloadTime: 2.05,
    damage: 19,
    headshotMultiplier: 1.45,
    pellets: 7,
    spread: 0.052,
    automatic: false,
    viewScale: [1.06, 0.95, 1.22],
    viewPosition: [0.33, -0.31, -0.73],
    accent: 0x7e3926,
  },
  marksman: {
    id: 'marksman',
    name: 'WIDOWMAKER RIFLE',
    magazineSize: 12,
    startingReserve: 72,
    fireDelay: 0.29,
    reloadTime: 1.9,
    damage: 78,
    headshotMultiplier: 2.2,
    pellets: 1,
    spread: 0.0012,
    automatic: false,
    viewScale: [1.02, 0.96, 1.33],
    viewPosition: [0.31, -0.3, -0.76],
    accent: 0x4e6870,
    scopeFov: 28,
  },
  lmg: {
    id: 'lmg',
    name: 'FOUNDRY 76 LMG',
    magazineSize: 76,
    startingReserve: 304,
    fireDelay: 0.092,
    reloadTime: 2.75,
    damage: 31,
    headshotMultiplier: 1.72,
    pellets: 1,
    spread: 0.006,
    automatic: true,
    viewScale: [1.12, 1.02, 1.2],
    viewPosition: [0.3, -0.33, -0.72],
    accent: 0xb18b35,
  },
  harpoon: {
    id: 'harpoon',
    name: 'LEVIATHAN HARPOON',
    magazineSize: 5,
    startingReserve: 35,
    fireDelay: 0.82,
    reloadTime: 2.2,
    damage: 168,
    headshotMultiplier: 2.55,
    pellets: 1,
    spread: 0.0007,
    automatic: false,
    viewScale: [1.04, 1.04, 1.58],
    viewPosition: [0.29, -0.31, -0.84],
    accent: 0x4b8a8f,
    scopeFov: 31,
    special: true,
  },
  arc: {
    id: 'arc',
    name: 'ARC-FURNACE PROTOTYPE',
    magazineSize: 18,
    startingReserve: 90,
    fireDelay: 0.24,
    reloadTime: 2.1,
    damage: 94,
    headshotMultiplier: 2.05,
    pellets: 1,
    spread: 0.0018,
    automatic: false,
    viewScale: [0.98, 1.05, 1.24],
    viewPosition: [0.32, -0.29, -0.7],
    accent: 0x4cc9d8,
    special: true,
  },
}

export function weaponFor(id: WeaponId): WeaponDefinition {
  return WEAPONS[id]
}
