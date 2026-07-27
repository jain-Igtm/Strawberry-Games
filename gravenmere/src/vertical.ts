export interface FloorSurface {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  originX: number
  originZ: number
  baseY: number
  slopeX?: number
  slopeZ?: number
  priority?: number
}

export function flatSurface(
  x: number,
  z: number,
  width: number,
  depth: number,
  y = 0,
  priority = 0,
): FloorSurface {
  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    originX: x,
    originZ: z,
    baseY: y,
    priority,
  }
}

export function rampSurface(
  x: number,
  z: number,
  width: number,
  depth: number,
  startY: number,
  endY: number,
  axis: 'x' | 'z',
  ascending: 1 | -1,
  priority = 10,
): FloorSurface {
  const run = axis === 'x' ? width : depth
  const slope = ((endY - startY) / run) * ascending
  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    originX: axis === 'x' ? x - (width / 2) * ascending : x,
    originZ: axis === 'z' ? z - (depth / 2) * ascending : z,
    baseY: startY,
    slopeX: axis === 'x' ? slope : 0,
    slopeZ: axis === 'z' ? slope : 0,
    priority,
  }
}

export function surfaceHeight(surface: FloorSurface, x: number, z: number): number {
  return (
    surface.baseY +
    (x - surface.originX) * (surface.slopeX ?? 0) +
    (z - surface.originZ) * (surface.slopeZ ?? 0)
  )
}

export function sampleFloorHeight(
  surfaces: readonly FloorSurface[],
  x: number,
  z: number,
  currentY: number,
  maxStepUp = 0.78,
  maxDrop = 3.8,
): number | null {
  let best: { y: number; priority: number; distance: number } | null = null
  for (const surface of surfaces) {
    if (x < surface.minX || x > surface.maxX || z < surface.minZ || z > surface.maxZ) continue
    const y = surfaceHeight(surface, x, z)
    if (y > currentY + maxStepUp || y < currentY - maxDrop) continue
    const candidate = {
      y,
      priority: surface.priority ?? 0,
      distance: Math.abs(y - currentY),
    }
    if (
      !best ||
      candidate.priority > best.priority ||
      (candidate.priority === best.priority && candidate.distance < best.distance) ||
      (candidate.priority === best.priority && candidate.distance === best.distance && candidate.y > best.y)
    ) {
      best = candidate
    }
  }
  return best?.y ?? null
}
