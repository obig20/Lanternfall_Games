import { describe, expect, it } from 'vitest';
import { Box } from '../src/physics/aabb';
import { clipRay, rayBoxDistance } from '../src/physics/raycast';

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box => ({
  min: { x: x0, y: y0, z: z0 },
  max: { x: x1, y: y1, z: z1 },
});
const O = { x: 0, y: 0, z: 0 };
const PX = { x: 1, y: 0, z: 0 };

describe('rayBoxDistance', () => {
  it('returns the distance to the near face', () => {
    expect(rayBoxDistance(O, PX, box(3, -1, -1, 5, 1, 1), 100)).toBeCloseTo(3);
  });

  it('misses a box that is off to the side', () => {
    expect(rayBoxDistance(O, PX, box(3, 2, -1, 5, 4, 1), 100)).toBe(null);
  });

  it('ignores a box that is behind the ray', () => {
    expect(rayBoxDistance(O, PX, box(-5, -1, -1, -3, 1, 1), 100)).toBe(null);
  });

  it('ignores a hit that is farther than maxDist', () => {
    expect(rayBoxDistance(O, PX, box(10, -1, -1, 12, 1, 1), 5)).toBe(null);
    expect(rayBoxDistance(O, PX, box(10, -1, -1, 12, 1, 1), 11)).toBeCloseTo(10);
  });

  it('treats a ray that starts inside the box as no hit', () => {
    expect(rayBoxDistance(O, PX, box(-1, -1, -1, 1, 1, 1), 100)).toBe(null);
  });

  it('handles a ray parallel to a slab, inside and outside it', () => {
    expect(rayBoxDistance(O, PX, box(2, -1, -0.5, 3, 1, 0.5), 100)).toBeCloseTo(2);
    expect(rayBoxDistance(O, PX, box(2, 0.5, -1, 3, 1, 1), 100)).toBe(null);
  });

  it('works on a diagonal ray', () => {
    const s = Math.SQRT1_2;
    const t = rayBoxDistance(O, { x: s, y: s, z: 0 }, box(2, 2, -1, 4, 4, 1), 100);
    expect(t).toBeCloseTo(2 * Math.SQRT2);
  });
});

describe('clipRay', () => {
  it('returns the full distance when nothing is in the way', () => {
    expect(clipRay(O, PX, 8, [])).toBe(8);
    expect(clipRay(O, PX, 8, [box(20, -1, -1, 22, 1, 1)])).toBe(8);
  });

  it('stops short of a wall by the padding', () => {
    expect(clipRay(O, PX, 8, [box(5, -1, -1, 6, 1, 1)], 0.3)).toBeCloseTo(4.7);
  });

  it('uses the nearest of several obstacles', () => {
    const boxes = [box(7, -1, -1, 8, 1, 1), box(4, -1, -1, 5, 1, 1), box(6, -1, -1, 7, 1, 1)];
    expect(clipRay(O, PX, 8, boxes, 0)).toBeCloseTo(4);
  });

  it('never goes below the minimum distance', () => {
    expect(clipRay(O, PX, 8, [box(0.5, -1, -1, 1, 1, 1)], 0.3, 1.2)).toBe(1.2);
  });

  it('never exceeds maxDist even when the minimum is larger', () => {
    expect(clipRay(O, PX, 0.5, [box(0.6, -1, -1, 1, 1, 1)], 0.3, 1.2)).toBe(0.5);
  });
});
