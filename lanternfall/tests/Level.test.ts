import { describe, expect, it } from 'vitest';
import { Box, Vec3, overlaps } from '../src/physics/aabb';
import { PHYSICS, PLAYER_HALF, PlayerBody } from '../src/physics/PlayerBody';
import { LANTERN, Lantern, RevealTracker, isLit } from '../src/world/LightReveal';
import {
  BEACONS, BEACON_RANGE, CHECKPOINTS, GOAL, KILL_Y, PLATFORMS, PlatformDef, ROUTE, SPAWN,
  inTrigger, platformBox, platformById, platformUnder, pulseReaches, respawnPosition,
} from '../src/world/LevelData';

const DT = 1 / 120;
const hiddenDefs = PLATFORMS.filter((q) => q.hidden).map((q) => ({ id: q.id, box: platformBox(q), locked: q.locked }));
const lockedIds = PLATFORMS.filter((q) => q.locked).map((q) => q.id);
const staticBoxes = PLATFORMS.filter((q) => !q.hidden).map(platformBox);

/** Point where a ray from the platform's centre toward `toward` leaves the platform's top rectangle. */
function edgePoint(from: PlatformDef, toward: PlatformDef): { edge: Vec3; dir: { x: number; z: number }; t: number } {
  let dx = toward.cx - from.cx;
  let dz = toward.cz - from.cz;
  const n = Math.hypot(dx, dz);
  dx /= n; dz /= n;
  const tx = dx === 0 ? Infinity : (from.w / 2) / Math.abs(dx);
  const tz = dz === 0 ? Infinity : (from.d / 2) / Math.abs(dz);
  const t = Math.min(tx, tz);
  return { edge: { x: from.cx + dx * t, y: from.topY, z: from.cz + dz * t }, dir: { x: dx, z: dz }, t };
}

const lanternPosOf = (b: PlayerBody): Vec3 => ({ x: b.pos.x, y: b.feetY + 1.3, z: b.pos.z });

interface Hop { ok: boolean; pulsed: boolean }

/** A bot that runs up to the edge, jumps `early` metres before it, and steers at the target. */
function hop(from: PlatformDef, to: PlatformDef, early: number): Hop {
  const { edge, dir, t } = edgePoint(from, to);
  const run = Math.min(3.5, t);
  const body = new PlayerBody({ x: edge.x - dir.x * run, y: from.topY + PLAYER_HALF.y + 0.01, z: edge.z - dir.z * run });
  const lantern = new Lantern();
  const reveal = new RevealTracker();
  reveal.unlock(lockedIds); // the beacon has already been woken
  let pulsed = false;
  let jumped = false;

  const solids = (): Box[] => [...staticBoxes, ...hiddenDefs.filter((h) => reveal.isSolid(h.id)).map((h) => h.box)];
  const tick = (jump: boolean, mx: number, mz: number) => {
    lantern.update(DT);
    reveal.update(DT, hiddenDefs, lanternPosOf(body), lantern.radius);
    return body.step(DT, { moveX: mx, moveZ: mz, jumpPressed: jump }, solids());
  };

  // Standing still: let hidden ground under us appear, then pulse if the target is still dark.
  for (let i = 0; i < 20; i++) tick(false, 0, 0);
  if (to.hidden && !to.locked && !isLit(platformBox(to), { x: edge.x, y: edge.y + 1.3, z: edge.z }, lantern.radius)) {
    pulsed = lantern.tryPulse();
  }

  for (let i = 0; i < 6 / DT; i++) {
    const toX = to.cx - body.pos.x;
    const toZ = to.cz - body.pos.z;
    const m = Math.hypot(toX, toZ) || 1;
    const progress = (body.pos.x - edge.x) * dir.x + (body.pos.z - edge.z) * dir.z; // <0 before the edge
    const wantJump = !jumped && body.grounded && progress >= -early;
    if (wantJump) jumped = true;
    tick(wantJump, toX / m, toZ / m);
    if (jumped && body.grounded) {
      const onTarget = Math.abs(body.pos.x - to.cx) <= to.w / 2 && Math.abs(body.pos.z - to.cz) <= to.d / 2 &&
        Math.abs(body.feetY - to.topY) < 0.05;
      return { ok: onTarget, pulsed };
    }
    if (body.pos.y < to.topY - 4) break;
  }
  return { ok: false, pulsed };
}

describe('level layout', () => {
  it('has unique platform ids and a valid route', () => {
    const ids = PLATFORMS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ROUTE) expect(ids.includes(id)).toBe(true);
    expect(ROUTE[0]).toBe('S');
    expect(ROUTE[ROUTE.length - 1]).toBe('G2');
  });

  it('has no overlapping platforms', () => {
    for (let i = 0; i < PLATFORMS.length; i++) {
      for (let j = i + 1; j < PLATFORMS.length; j++) {
        expect(overlaps(platformBox(PLATFORMS[i]), platformBox(PLATFORMS[j]))).toBe(false);
      }
    }
  });

  it('spawns the player standing on the start platform', () => {
    const body = new PlayerBody(SPAWN);
    for (let i = 0; i < 120; i++) body.step(DT, { moveX: 0, moveZ: 0, jumpPressed: false }, staticBoxes);
    expect(body.grounded).toBe(true);
    expect(Math.abs(body.feetY) < 0.01).toBe(true);
  });

  it('kill height is well below every platform', () => {
    for (const q of PLATFORMS) expect(KILL_Y < q.topY - 10).toBe(true);
  });
});

describe('route is completable', () => {
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const from = platformById(ROUTE[i]);
    const to = platformById(ROUTE[i + 1]);
    it(`${from.id} -> ${to.id}: jump at the edge`, () => {
      expect(hop(from, to, 0).ok).toBe(true);
    });
    it(`${from.id} -> ${to.id}: jump 0.4 m early (forgiving timing)`, () => {
      expect(hop(from, to, 0.4).ok).toBe(true);
    });
  }

  it('every step up is within what a jump can clear', () => {
    const maxRise = (PHYSICS.jumpSpeed ** 2) / (2 * PHYSICS.gravity);
    for (let i = 0; i < ROUTE.length - 1; i++) {
      const rise = platformById(ROUTE[i + 1]).topY - platformById(ROUTE[i]).topY;
      expect(rise < maxRise - 0.5).toBe(true);
    }
  });
});

describe('lantern puzzle design', () => {
  const lit = (fromId: string, toId: string, radius: number): boolean => {
    const from = platformById(fromId);
    const to = platformById(toId);
    const { edge } = edgePoint(from, to);
    return isLit(platformBox(to), { x: edge.x, y: from.topY + 1.3, z: edge.z }, radius);
  };

  it('nothing hidden is lit from the spawn point', () => {
    const b = new PlayerBody(SPAWN);
    for (const h of hiddenDefs) expect(isLit(h.box, lanternPosOf(b), LANTERN.heldRadius)).toBe(false);
  });

  it('H1, H2 and H4, H6 are revealed by the held light from the previous edge', () => {
    expect(lit('B', 'H1', LANTERN.heldRadius)).toBe(true);
    expect(lit('H1', 'H2', LANTERN.heldRadius)).toBe(true);
    expect(lit('C1', 'H4', LANTERN.heldRadius)).toBe(true);
    expect(lit('H5', 'H6', LANTERN.heldRadius)).toBe(true);
  });

  it('H3 and H5 are dark to the held light but visible to a pulse', () => {
    expect(lit('H2', 'H3', LANTERN.heldRadius)).toBe(false);
    expect(lit('H2', 'H3', LANTERN.pulseRadius)).toBe(true);
    expect(lit('H4', 'H5', LANTERN.heldRadius)).toBe(false);
    expect(lit('H4', 'H5', LANTERN.pulseRadius)).toBe(true);
  });

  it('the bot pulses at the two hard gaps', () => {
    expect(hop(platformById('H2'), platformById('H3'), 0).pulsed).toBe(true);
    expect(hop(platformById('H4'), platformById('H5'), 0).pulsed).toBe(true);
  });
});

describe('Room 2 beacon puzzle', () => {
  const beacon = BEACONS[0];
  const lantern = (id: string, dx = 0, dz = 0): Vec3 => {
    const d = platformById(id);
    return { x: d.cx + dx, y: d.topY + 1.3, z: d.cz + dz };
  };

  it('the beacon unlocks exactly the locked bridge platforms', () => {
    expect([...beacon.unlocks].sort()).toEqual([...lockedIds].sort());
  });

  it('locked platforms ignore the lantern, even a pulse right next to them', () => {
    const t = new RevealTracker();
    t.update(0.5, hiddenDefs, lantern('R2a', 0, -2.4), LANTERN.pulseRadius);
    for (const id of lockedIds) expect(t.isSolid(id)).toBe(false);
  });

  it('waking the beacon makes the bridge solid, and it survives a respawn', () => {
    const t = new RevealTracker();
    expect(t.unlock(beacon.unlocks).length).toBe(beacon.unlocks.length);
    expect(t.unlock(beacon.unlocks)).toEqual([]);
    t.reset();
    for (const id of lockedIds) expect(t.isSolid(id)).toBe(true);
    t.clearPins();
    for (const id of lockedIds) expect(t.isSolid(id)).toBe(false);
  });

  it('a pulse from the bridge-side platform R2a does not reach the crystal', () => {
    // Worst case: standing at R2a's west edge, hanging over by the player's half-width.
    const r2a = platformById('R2a');
    const edge: Vec3 = { x: r2a.cx - r2a.w / 2 - 0.35, y: r2a.topY + 1.3, z: beacon.z };
    expect(pulseReaches(beacon, edge)).toBe(false);
  });

  it('a pulse from the beacon ledge R2b reaches the crystal from anywhere on it', () => {
    const r2b = platformById('R2b');
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
      const pos = lantern('R2b', (sx * r2b.w) / 2, (sz * r2b.d) / 2);
      expect(pulseReaches(beacon, pos)).toBe(true);
    }
  });

  it('the beacon range is smaller than the pulse radius (you must come close)', () => {
    expect(BEACON_RANGE < LANTERN.pulseRadius).toBe(true);
  });

  it('the beacon ledge can be reached and left (round trip)', () => {
    expect(hop(platformById('R2a'), platformById('R2b'), 0).ok).toBe(true);
    expect(hop(platformById('R2a'), platformById('R2b'), 0.4).ok).toBe(true);
    expect(hop(platformById('R2b'), platformById('R2a'), 0).ok).toBe(true);
    expect(hop(platformById('R2b'), platformById('R2a'), 0.4).ok).toBe(true);
  });
});

describe('platformUnder', () => {
  it('identifies the platform being stood on, including hanging over the edge', () => {
    const h3 = platformById('H3');
    expect(platformUnder({ x: h3.cx, y: h3.topY, z: h3.cz }, PLATFORMS)).toBe('H3');
    expect(platformUnder({ x: h3.cx + h3.w / 2 + 0.3, y: h3.topY, z: h3.cz }, PLATFORMS)).toBe('H3');
  });

  it('returns null in mid-air or far from any platform', () => {
    const h3 = platformById('H3');
    expect(platformUnder({ x: h3.cx, y: h3.topY + 1, z: h3.cz }, PLATFORMS)).toBe(null);
    expect(platformUnder({ x: 50, y: 0, z: 50 }, PLATFORMS)).toBe(null);
  });
});

describe('checkpoint and goal triggers', () => {
  const feetOn = (id: string): Vec3 => {
    const d = platformById(id);
    return { x: d.cx, y: d.topY, z: d.cz };
  };

  it('checkpoints trigger on their own platform only', () => {
    expect(inTrigger(feetOn('C1'), CHECKPOINTS[0])).toBe(true);
    expect(inTrigger(feetOn('S'), CHECKPOINTS[0])).toBe(false);
    expect(inTrigger(feetOn('H4'), CHECKPOINTS[0])).toBe(false);
    expect(inTrigger(feetOn('G'), CHECKPOINTS[1])).toBe(true);
    expect(inTrigger(feetOn('C1'), CHECKPOINTS[1])).toBe(false);
  });

  it('goal triggers on G only, and not when far below', () => {
    expect(inTrigger(feetOn('G2'), GOAL)).toBe(true);
    expect(inTrigger(feetOn('G'), GOAL)).toBe(false);
    expect(inTrigger(feetOn('L3'), GOAL)).toBe(false);
    expect(inTrigger({ x: GOAL.x, y: GOAL.y - 10, z: GOAL.z }, GOAL)).toBe(false);
  });

  it('respawn position stands the player on the checkpoint', () => {
    const b = new PlayerBody(respawnPosition(CHECKPOINTS[0]));
    for (let i = 0; i < 120; i++) b.step(DT, { moveX: 0, moveZ: 0, jumpPressed: false }, staticBoxes);
    expect(b.grounded).toBe(true);
    expect(Math.abs(b.feetY - CHECKPOINTS[0].y) < 0.01).toBe(true);
  });
});
