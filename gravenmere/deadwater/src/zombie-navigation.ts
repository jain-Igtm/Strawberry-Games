export type HorizontalPosition = {
  x: number
  z: number
}

export type NavigationProbe = (
  x: number,
  z: number,
  radius: number,
) => boolean

export type HorizontalBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function circleIntersectsBounds(
  x: number,
  z: number,
  radius: number,
  bounds: HorizontalBounds,
): boolean {
  const closestX = Math.max(bounds.minX, Math.min(bounds.maxX, x))
  const closestZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, z))
  const dx = x - closestX
  const dz = z - closestZ
  return dx * dx + dz * dz < radius * radius
}

/**
 * Moves a circle using short, axis-separated steps. Testing each intermediate
 * point prevents a long frame from placing an enemy on the far side of a thin
 * wall, while axis separation preserves natural wall sliding.
 */
export function moveCircleSwept(
  position: HorizontalPosition,
  dx: number,
  dz: number,
  radius: number,
  isWalkable: NavigationProbe,
  isBlocked: NavigationProbe,
  maximumStep = 0.16,
): boolean {
  const distance = Math.hypot(dx, dz)
  const steps = Math.max(1, Math.ceil(distance / maximumStep))
  const stepX = dx / steps
  const stepZ = dz / steps
  let moved = false

  for (let step = 0; step < steps; step += 1) {
    const nextX = position.x + stepX
    if (
      isWalkable(nextX, position.z, radius) &&
      !isBlocked(nextX, position.z, radius)
    ) {
      position.x = nextX
      moved = true
    }

    const nextZ = position.z + stepZ
    if (
      isWalkable(position.x, nextZ, radius) &&
      !isBlocked(position.x, nextZ, radius)
    ) {
      position.z = nextZ
      moved = true
    }
  }

  return moved
}

export function lerpRadians(
  current: number,
  target: number,
  amount: number,
): number {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  )
  return current + delta * Math.max(0, Math.min(1, amount))
}
