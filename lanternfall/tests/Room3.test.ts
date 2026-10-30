import { describe, expect, it } from 'vitest';
import { PHYSICS } from '../src/physics/PlayerBody';
import { MOVERS, PLATFORMS, ROUTE_3, platformBox } from '../src/world/LevelData';
import { cycleLength, moverBox, moverTop } from '../src/world/MovingPlatform';
import { overlaps } from '../src/physics/aabb';
import { spotOf, windowFraction } from './helpers/room3Sim';

const hops: Array<[string, string]> = ROUTE_3.slice(0, -1).map((id, i) => [id, ROUTE_3[i + 1]]);

describe('Room 3 layout', () => {
  it('every route entry is a real platform or mover, with no id used twice', () => {
    const ids = [...PLATFORMS.map((p) => p.id), ...MOVERS.map((m) => m.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ROUTE_3) expect(ids.includes(id)).toBe(true);
    expect(ROUTE_3[0]).toBe('G2');
    expect(ROUTE_3[ROUTE_3.length - 1]).toBe('G3');
  });

  it('movers never pass through a static platform at any moment of their cycle', () => {
    const statics = PLATFORMS.map(platformBox);
    for (const m of MOVERS) {
      for (let t = 0; t < 20; t += 0.25) {
        for (const s of statics) expect(overlaps(moverBox(m, t), s)).toBe(false);
      }
    }
  });

  it('movers stay on their line: sideways movers keep their height, the lift keeps its x and z', () => {
    for (const m of MOVERS) {
      for (let t = 0; t < 12; t += 0.5) {
        const c = moverTop(m, t);
        if (m.from.topY === m.to.topY) expect(c.topY).toBe(m.from.topY);
        if (m.from.x === m.to.x && m.from.z === m.to.z) {
          expect(c.x).toBe(m.from.x);
          expect(c.z).toBe(m.from.z);
        }
      }
    }
  });

  /** Height of a route entry for a given hop: the lift is entered at the bottom of its ride and left from the top. */
  const V1 = MOVERS.find((m) => m.id === 'V1')!;
  const heightFor = (id: string, role: 'source' | 'target'): number => {
    if (id === 'V1') return role === 'target' ? V1.from.topY : V1.to.topY;
    return spotOf(id, 0).topY;
  };

  it('every step up along the route is within what a jump can clear', () => {
    const maxRise = PHYSICS.jumpSpeed ** 2 / (2 * PHYSICS.gravity);
    for (const [a, b] of hops) {
      const rise = heightFor(b, 'target') - heightFor(a, 'source');
      expect(rise).toBeLessThan(maxRise - 0.5);
    }
  });

  it('the lift is mandatory: the gate is too high to jump to from the rest stop or the bottom of the lift', () => {
    const maxRise = PHYSICS.jumpSpeed ** 2 / (2 * PHYSICS.gravity);
    const g3 = spotOf('G3', 0).topY;
    expect(g3 - spotOf('R3a', 0).topY).toBeGreaterThan(maxRise);
    expect(g3 - V1.from.topY).toBeGreaterThan(maxRise);
  });

  it('the lift is long enough to be worth waiting for but short enough to wait out', () => {
    expect(V1.to.topY - V1.from.topY).toBeGreaterThan(2);
    expect(cycleLength(V1)).toBeLessThan(10);
  });
});

describe('Room 3 is fair: every hop has a generous timing window', () => {
  // A bot that always runs and jumps immediately, started at every moment of the cycle.
  // It must succeed from a good share of them, so a human who waits and watches has plenty of room.
  for (const [a, b] of hops) {
    it(`${a} -> ${b}: at least 25% of start moments work`, () => {
      expect(windowFraction(a, b)).toBeGreaterThanOrEqual(0.25);
    });
  }

  it('there is not a single hop that is always trivial for all three movers (timing still matters somewhere)', () => {
    const fractions = hops.map(([a, b]) => windowFraction(a, b));
    expect(fractions.some((f) => f < 0.95)).toBe(true);
  });

  it('M1 and M2 are out of step, so crossing from one to the other needs a look first', () => {
    expect(windowFraction('M1', 'M2')).toBeLessThan(0.95);
  });
});
