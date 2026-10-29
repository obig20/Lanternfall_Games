/** Axis-aligned boxes: the shape of every platform and of the player. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Box {
  min: Vec3;
  max: Vec3;
}

/** Overlaps smaller than this are ignored, so standing exactly on a surface is not a "hit". */
export const EPS = 1e-4;

export function overlaps(a: Box, b: Box): boolean {
  return (
    a.min.x < b.max.x - EPS && a.max.x > b.min.x + EPS &&
    a.min.y < b.max.y - EPS && a.max.y > b.min.y + EPS &&
    a.min.z < b.max.z - EPS && a.max.z > b.min.z + EPS
  );
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Distance from a point to the nearest point of a box (0 if the point is inside). */
export function distanceToBox(box: Box, p: Vec3): number {
  const dx = p.x - clamp(p.x, box.min.x, box.max.x);
  const dy = p.y - clamp(p.y, box.min.y, box.max.y);
  const dz = p.z - clamp(p.z, box.min.z, box.max.z);
  return Math.hypot(dx, dy, dz);
}
