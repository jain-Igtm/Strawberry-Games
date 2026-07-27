export interface RectCollider {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  enabled: boolean
  minY?: number
  maxY?: number
}

export function clampPitch(pitch: number): number {
  return Math.max(-1.24, Math.min(1.08, pitch))
}

export function circleIntersectsRect(
  x: number,
  z: number,
  radius: number,
  collider: RectCollider,
): boolean {
  if (!collider.enabled) return false
  const nearestX = Math.max(collider.minX, Math.min(x, collider.maxX))
  const nearestZ = Math.max(collider.minZ, Math.min(z, collider.maxZ))
  const dx = x - nearestX
  const dz = z - nearestZ
  return dx * dx + dz * dz < radius * radius
}

export function circleIntersectsRectAtHeight(
  x: number,
  z: number,
  feetY: number,
  playerHeight: number,
  radius: number,
  collider: RectCollider,
): boolean {
  if (!collider.enabled) return false
  const minY = collider.minY ?? Number.NEGATIVE_INFINITY
  const maxY = collider.maxY ?? Number.POSITIVE_INFINITY
  if (feetY + playerHeight <= minY || feetY >= maxY) return false
  return circleIntersectsRect(x, z, radius, collider)
}

export function adaptivePixelRatio(
  current: number,
  averageFrameMs: number,
  deviceRatio: number,
): number {
  const ceiling = Math.min(deviceRatio || 1, 1.35)
  if (averageFrameMs > 27 && current > 0.78) return Math.max(0.78, current - 0.08)
  if (averageFrameMs < 18 && current < ceiling) return Math.min(ceiling, current + 0.04)
  return current
}

export function smoothstep(min: number, max: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return t * t * (3 - 2 * t)
}
