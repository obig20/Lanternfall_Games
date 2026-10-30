import { Box, EPS, Vec3, overlaps } from '../physics/aabb';
import { PlayerBody } from '../physics/PlayerBody';
import { MoverDef, PLATFORM_THICKNESS } from './LevelData';

const smooth = (u: number): number => u * u * (3 - 2 * u);

/** Distance between the two ends of the path, in metres. */
export function pathLength(def: MoverDef): number {
  return Math.hypot(def.to.x - def.from.x, def.to.topY - def.from.topY, def.to.z - def.from.z);
}

/** Seconds for one full there-and-back cycle, including the pauses. */
export function cycleLength(def: MoverDef): number {
  const travel = def.speed > 0 ? pathLength(def) / def.speed : 0;
  return 2 * (travel + def.pause);
}

/**
 * 0 = at `from`, 1 = at `to`, at time `t` seconds.
 * The motion is a pure function of time (no state), so it is deterministic and easy to test.
 * It eases in and out of each end, then waits `pause` seconds.
 */
export function moverProgress(def: MoverDef, t: number): number {
  const travel = def.speed > 0 ? pathLength(def) / def.speed : 0;
  const leg = travel + def.pause;
  const cycle = 2 * leg;
  if (travel <= 0 || cycle <= 0) return 0;
  const c = (((t + def.phase) % cycle) + cycle) % cycle;
  if (c < travel) return smooth(c / travel);
  if (c < leg) return 1;
  if (c < leg + travel) return 1 - smooth((c - leg) / travel);
  return 0;
}

/** Centre of the platform's top surface at time `t`. */
export function moverTop(def: MoverDef, t: number): { x: number; topY: number; z: number } {
  const u = moverProgress(def, t);
  return {
    x: def.from.x + (def.to.x - def.from.x) * u,
    topY: def.from.topY + (def.to.topY - def.from.topY) * u,
    z: def.from.z + (def.to.z - def.from.z) * u,
  };
}

export function moverBox(def: MoverDef, t: number): Box {
  const c = moverTop(def, t);
  return {
    min: { x: c.x - def.w / 2, y: c.topY - PLATFORM_THICKNESS, z: c.z - def.d / 2 },
    max: { x: c.x + def.w / 2, y: c.topY, z: c.z + def.d / 2 },
  };
}

function standsOn(feet: Vec3, def: MoverDef, t: number, margin: number): boolean {
  const c = moverTop(def, t);
  return (
    Math.abs(feet.y - c.topY) < 0.06 &&
    Math.abs(feet.x - c.x) <= def.w / 2 + margin &&
    Math.abs(feet.z - c.z) <= def.d / 2 + margin
  );
}

/** Which mover are these feet standing on (at time `t`)? null if none. Same edge margin as platformUnder. */
export function moverUnder(feet: Vec3, defs: readonly MoverDef[], t: number, margin = 0.35): string | null {
  for (const d of defs) if (standsOn(feet, d, t, margin)) return d.id;
  return null;
}

/**
 * How far a rider standing on the mover at time `tPrev` must be shifted so they stay on it at `tNow`.
 * Returns null when the player is airborne or is not on this mover.
 */
export function riderDelta(feet: Vec3, grounded: boolean, def: MoverDef, tPrev: number, tNow: number, margin = 0.1): Vec3 | null {
  if (!grounded || !standsOn(feet, def, tPrev, margin)) return null;
  const a = moverTop(def, tPrev);
  const b = moverTop(def, tNow);
  return { x: b.x - a.x, y: b.topY - a.topY, z: b.z - a.z };
}

/**
 * Smallest move that gets box `a` out of box `b`, or null if they do not overlap.
 * Used when a moving platform slides into the player from the side or rises into them.
 */
export function pushOutVector(a: Box, b: Box): Vec3 | null {
  if (!overlaps(a, b)) return null;
  const depth = (axis: 'x' | 'y' | 'z'): { amount: number; sign: number } => {
    const up = b.max[axis] - a.min[axis]; // push a toward +axis
    const down = a.max[axis] - b.min[axis]; // push a toward -axis
    return up < down ? { amount: up, sign: 1 } : { amount: down, sign: -1 };
  };
  const x = depth('x');
  const y = depth('y');
  const z = depth('z');
  const best = [
    { axis: 'x' as const, ...x },
    { axis: 'y' as const, ...y },
    { axis: 'z' as const, ...z },
  ].sort((p, q) => p.amount - q.amount)[0];
  const out: Vec3 = { x: 0, y: 0, z: 0 };
  out[best.axis] = best.sign * (best.amount + EPS);
  return out;
}

/**
 * Advance the world's moving platforms from `tPrev` to `tNow` for this player:
 * 1. carry the player along if they are standing on a solid mover,
 * 2. push them out of any mover that slid into them.
 * Returns the boxes of the solid movers at `tNow`, for the player's collision step.
 * `isSolid` lets hidden movers (only solid while lit) opt out.
 */
export function applyMovers(
  body: PlayerBody,
  defs: readonly MoverDef[],
  tPrev: number,
  tNow: number,
  isSolid: (id: string) => boolean = () => true,
): Box[] {
  const solid = defs.filter((d) => isSolid(d.id));
  const feet = { x: body.pos.x, y: body.feetY, z: body.pos.z };
  for (const def of solid) {
    const carry = riderDelta(feet, body.grounded, def, tPrev, tNow);
    if (carry) {
      body.pos.x += carry.x;
      body.pos.y += carry.y;
      body.pos.z += carry.z;
      break; // a player stands on one thing at a time
    }
  }
  const boxes = solid.map((d) => moverBox(d, tNow));
  for (const box of boxes) {
    const push = pushOutVector(body.box, box);
    if (push) {
      body.pos.x += push.x;
      body.pos.y += push.y;
      body.pos.z += push.z;
      if (push.y > 0) body.vel.y = Math.max(body.vel.y, 0);
    }
  }
  return boxes;
}
