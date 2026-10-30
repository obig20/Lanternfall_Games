import { Box, Vec3 } from './aabb';

const AXES = ['x', 'y', 'z'] as const;

function inside(origin: Vec3, box: Box): boolean {
  return AXES.every((a) => origin[a] >= box.min[a] && origin[a] <= box.max[a]);
}

/**
 * Distance along a ray at which it first ENTERS `box` (the "slab" method).
 * `dir` must have length 1.
 * Returns null when the ray misses, starts inside the box, or only hits it beyond `maxDist`.
 * (Starting inside is "no hit" on purpose: a camera that is already inside a slab should not collapse.)
 */
export function rayBoxDistance(origin: Vec3, dir: Vec3, box: Box, maxDist: number): number | null {
  if (inside(origin, box)) return null;
  let tMin = 0;
  let tMax = maxDist;
  for (const axis of AXES) {
    const o = origin[axis];
    const d = dir[axis];
    const lo = box.min[axis];
    const hi = box.max[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null; // travelling parallel to this slab and outside it
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

/**
 * How far along the ray we may travel before hitting any box, stopping `pad` metres short.
 * Never returns less than `minDist` (or `maxDist` if that is smaller), so the camera cannot
 * end up inside the player's head.
 */
export function clipRay(origin: Vec3, dir: Vec3, maxDist: number, boxes: readonly Box[], pad = 0.3, minDist = 1.2): number {
  let best = maxDist;
  for (const b of boxes) {
    const t = rayBoxDistance(origin, dir, b, best + pad);
    if (t !== null) best = Math.min(best, t - pad);
  }
  return Math.max(Math.min(minDist, maxDist), best);
}
