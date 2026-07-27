export interface RectCollider {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  enabled: boolean
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

export function adaptivePixelRatio(
  current: number,
  averageFrameMs: number,
  deviceRatio: number,
): number {
  const ceiling = Math.min(deviceRatio || 1, 1.15)
  if (averageFrameMs > 32 && current > 0.65) return Math.max(0.65, current - 0.2)
  if (averageFrameMs > 21 && current > 0.65) return Math.max(0.65, current - 0.1)
  if (averageFrameMs < 16.5 && current < ceiling) return Math.min(ceiling, current + 0.05)
  return current
}

export function smoothstep(min: number, max: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return t * t * (3 - 2 * t)
}
