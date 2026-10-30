import { describe, expect, it } from 'vitest';
import { Box } from '../src/physics/aabb';
import { PLAYER_HALF, PlayerBody } from '../src/physics/PlayerBody';
import { MoverDef, PLATFORM_THICKNESS } from '../src/world/LevelData';
import {
  applyMovers, cycleLength, moverBox, moverProgress, moverTop, moverUnder, pathLength, pushOutVector, riderDelta,
} from '../src/world/MovingPlatform';

const STEP = 1 / 60;

/** 10 m path along +X at 2 m/s: 5 s each way, 1 s pause at each end, cycle = 12 s. */
const slider: MoverDef = {
  id: 'T', hidden: false, from: { x: 0, topY: 0, z: 0 }, to: { x: 10, topY: 0, z: 0 }, w: 4, d: 4, speed: 2, pause: 1, phase: 0,
};
const lift: MoverDef = { ...slider, id: 'L', from: { x: 0, topY: 0, z: 0 }, to: { x: 0, topY: 3, z: 0 }, speed: 1 };

describe('mover timing', () => {
  it('measures path and cycle length', () => {
    expect(pathLength(slider)).toBeCloseTo(10);
    expect(cycleLength(slider)).toBeCloseTo(12);
  });

  it('starts at `from`, arrives at `to`, waits, and comes back', () => {
    expect(moverProgress(slider, 0)).toBe(0);
    expect(moverProgress(slider, 5)).toBeCloseTo(1);
    expect(moverProgress(slider, 5.5)).toBe(1); // pausing at the far end
    expect(moverProgress(slider, 6)).toBeCloseTo(1);
    expect(moverProgress(slider, 11)).toBeCloseTo(0);
    expect(moverProgress(slider, 11.9)).toBe(0); // pausing at the start
  });

  it('is periodic and handles negative time', () => {
    for (const t of [0.7, 3.3, 8.1]) {
      expect(moverProgress(slider, t + 12)).toBeCloseTo(moverProgress(slider, t));
      expect(moverProgress(slider, t - 12)).toBeCloseTo(moverProgress(slider, t));
    }
  });

  it('moves smoothly and monotonically on the way out, easing at the ends', () => {
    let last = 0;
    for (let t = 0; t <= 5; t += 0.1) {
      const u = moverProgress(slider, t);
      expect(u).toBeGreaterThanOrEqual(last - 1e-9);
      last = u;
    }
    expect(moverProgress(slider, 0.2)).toBeLessThan(0.2 / 5); // slower than a straight line at the start
    expect(moverProgress(slider, 2.5)).toBeCloseTo(0.5);
  });

  it('phase shifts the cycle', () => {
    const shifted = { ...slider, phase: 2.5 };
    expect(moverProgress(shifted, 0)).toBeCloseTo(moverProgress(slider, 2.5));
  });

  it('does not move when the path or speed is degenerate', () => {
    expect(moverProgress({ ...slider, to: slider.from }, 3)).toBe(0);
    expect(moverProgress({ ...slider, speed: 0 }, 3)).toBe(0);
    expect(Number.isFinite(cycleLength({ ...slider, speed: 0 }))).toBe(true);
  });
});

describe('mover geometry', () => {
  it('interpolates the top-surface centre', () => {
    expect(moverTop(slider, 2.5).x).toBeCloseTo(5);
    expect(moverTop(lift, 3).topY).toBeGreaterThan(0);
  });

  it('builds a box with the standard platform thickness under the top surface', () => {
    const b = moverBox(slider, 0);
    expect(b.max.y).toBe(0);
    expect(b.max.y - b.min.y).toBeCloseTo(PLATFORM_THICKNESS);
    expect(b.max.x - b.min.x).toBe(4);
    expect(b.max.z - b.min.z).toBe(4);
  });

  it('moverUnder finds the platform being stood on, with an edge margin', () => {
    expect(moverUnder({ x: 0, y: 0, z: 0 }, [slider], 0)).toBe('T');
    expect(moverUnder({ x: 2.3, y: 0, z: 0 }, [slider], 0)).toBe('T');
    expect(moverUnder({ x: 3, y: 0, z: 0 }, [slider], 0)).toBe(null);
    expect(moverUnder({ x: 0, y: 1, z: 0 }, [slider], 0)).toBe(null);
  });
});

describe('riderDelta', () => {
  it('gives the platform movement for a grounded rider', () => {
    const d = riderDelta({ x: 0, y: 0, z: 0 }, true, slider, 1, 2);
    expect(d).not.toBe(null);
    expect(d!.x).toBeGreaterThan(0);
    expect(d!.y).toBe(0);
  });

  it('gives nothing for airborne players or players beside the platform', () => {
    expect(riderDelta({ x: 0, y: 0, z: 0 }, false, slider, 1, 2)).toBe(null);
    expect(riderDelta({ x: 9, y: 0, z: 0 }, true, slider, 1, 2)).toBe(null);
    expect(riderDelta({ x: 0, y: 2, z: 0 }, true, slider, 1, 2)).toBe(null);
  });
});

describe('pushOutVector', () => {
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box => ({
    min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 },
  });

  it('is null when boxes only touch or are apart', () => {
    expect(pushOutVector(box(0, 0, 0, 1, 1, 1), box(1, 0, 0, 2, 1, 1))).toBe(null);
    expect(pushOutVector(box(0, 0, 0, 1, 1, 1), box(5, 5, 5, 6, 6, 6))).toBe(null);
  });

  it('pushes out along the shallowest axis, in the right direction', () => {
    const player = box(0.8, 0, 0, 1.8, 2, 1);
    const wall = box(1, -5, -5, 5, 5, 5); // overlaps the player by 0.8 in x
    const p = pushOutVector(player, wall)!;
    expect(p.x).toBeLessThan(0);
    expect(p.y).toBe(0);
    expect(p.z).toBe(0);
    const pushedRight = pushOutVector(box(4.5, 0, 0, 5.5, 2, 1), wall)!;
    expect(pushedRight.x).toBeGreaterThan(0);
  });

  it('lifts a player whose feet are just inside the top of a platform', () => {
    const player = box(-0.3, 0.9, -0.3, 0.3, 2.7, 0.3);
    const floor = box(-5, -1, -5, 5, 1, 5);
    expect(pushOutVector(player, floor)!.y).toBeGreaterThan(0);
  });
});

/** Put a player on top of a mover and step the same way the game does. */
function ride(def: MoverDef, seconds: number, startX = 0) {
  const body = new PlayerBody({ x: startX, y: def.from.topY + PLAYER_HALF.y + 0.01, z: 0 });
  let t = 0;
  for (let i = 0; i < seconds / STEP; i++) {
    const prev = t;
    t += STEP;
    const boxes = applyMovers(body, [def], prev, t);
    body.step(STEP, { moveX: 0, moveZ: 0, jumpPressed: false }, boxes);
  }
  return { body, t };
}

describe('applyMovers (carrying and pushing)', () => {
  it('a player standing still rides a sliding platform all the way across', () => {
    const { body, t } = ride(slider, 4.9);
    const top = moverTop(slider, t);
    expect(body.grounded).toBe(true);
    expect(body.feetY).toBeCloseTo(top.topY, 1);
    expect(body.pos.x).toBeCloseTo(top.x, 1);
    expect(top.x).toBeGreaterThan(9);
  });

  it('a lift carries the player up', () => {
    const { body, t } = ride(lift, 3);
    expect(body.grounded).toBe(true);
    expect(body.feetY).toBeCloseTo(moverTop(lift, t).topY, 1);
    expect(body.feetY).toBeGreaterThan(2.5);
  });

  it('a player standing beside a platform is not carried', () => {
    const body = new PlayerBody({ x: -6, y: PLAYER_HALF.y + 0.01, z: 0 });
    const floor: Box = { min: { x: -20, y: -1, z: -20 }, max: { x: 20, y: 0, z: 20 } };
    let t = 0;
    for (let i = 0; i < 120; i++) {
      const prev = t;
      t += STEP;
      applyMovers(body, [{ ...slider, from: { x: 0, topY: 5, z: 0 }, to: { x: 10, topY: 5, z: 0 } }], prev, t);
      body.step(STEP, { moveX: 0, moveZ: 0, jumpPressed: false }, [floor]);
    }
    expect(body.pos.x).toBeCloseTo(-6, 3);
  });

  it('a platform sliding into a standing player pushes them aside instead of teleporting them on top', () => {
    const body = new PlayerBody({ x: 5, y: PLAYER_HALF.y + 0.01, z: 0 });
    const floor: Box = { min: { x: -20, y: -1, z: -20 }, max: { x: 20, y: 0, z: 20 } };
    const wall: MoverDef = { ...slider, from: { x: 0, topY: 2, z: 0 }, to: { x: 10, topY: 2, z: 0 } }; // top at 2 m: a wall for a 1.8 m player
    let t = 1;
    for (let i = 0; i < 4 / STEP; i++) {
      const prev = t;
      t += STEP;
      const boxes = applyMovers(body, [wall], prev, t);
      body.step(STEP, { moveX: 0, moveZ: 0, jumpPressed: false }, [floor, ...boxes]);
      expect(body.feetY).toBeLessThan(0.5); // never launched on top of the platform
    }
    expect(body.pos.x).toBeGreaterThan(5);
  });

  it('skips movers that are not solid (an unlit hidden platform)', () => {
    const body = new PlayerBody({ x: 0, y: PLAYER_HALF.y + 0.01, z: 0 });
    body.grounded = true;
    const boxes = applyMovers(body, [slider], 0, 1, () => false);
    expect(boxes).toEqual([]);
    expect(body.pos.x).toBe(0);
  });
});
