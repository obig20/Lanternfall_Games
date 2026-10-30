import { Box, Vec3 } from '../physics/aabb';

/** All platform thickness. The TOP surface is what you stand on. */
export const PLATFORM_THICKNESS = 0.6;

export interface PlatformDef {
  id: string;
  /** Hidden platforms only exist while lit by the lantern. */
  hidden: boolean;
  cx: number;
  topY: number;
  cz: number;
  w: number;
  d: number;
  /** Hidden AND ignores the lantern: only a beacon can reveal it. */
  locked: boolean;
}

const p = (
  id: string, hidden: boolean, cx: number, topY: number, cz: number, w: number, d: number, locked = false,
): PlatformDef => ({ id, hidden, cx, topY, cz, w, d, locked });

/**
 * Room 1, "The Lantern Steps". The route runs toward -Z, climbing.
 * Gaps below ~2.6 are revealed by the held light as you walk up;
 * H3 and H5 have bigger gaps, so pulse (Q) to see them before leaping.
 */
export const PLATFORMS: readonly PlatformDef[] = [
  p('S', false, 0, 0, 0, 12, 12),
  p('A', false, 0, 0.6, -9.5, 4, 4),
  p('B', false, 2, 1.2, -15.5, 4, 4),
  p('H1', true, 2, 1.8, -20.5, 3, 3),
  p('H2', true, 2, 2.4, -25.5, 3, 3),
  p('H3', true, -3.5, 3.0, -30.5, 3, 3),
  p('C1', false, -4, 3.6, -37.5, 6, 6),
  p('H4', true, -4, 4.4, -44, 3, 3),
  p('H5', true, 2.3, 5.2, -44, 3, 3),
  p('H6', true, 2.5, 5.8, -49.5, 3, 3),
  p('G', false, 2.5, 6.6, -57, 6, 6), // checkpoint 2

  // Room 2, "The Beacon Span": wake the crystal on R2b, then cross the locked bridge.
  p('R2a', false, 2.5, 7.2, -64.5, 4, 4),
  p('R2b', false, -4.5, 7.8, -67, 4, 4), // beacon ledge (a short side trip)
  p('L1', true, 2.5, 7.8, -70, 3, 3, true),
  p('L2', true, 2.5, 8.4, -75.5, 3, 3, true),
  p('L3', true, 2.5, 9.0, -81, 3, 3, true),
  p('G2', false, 2.5, 9.6, -88, 6, 6), // checkpoint 3: the gallery entrance

  // Room 3, "The Drifting Gallery": M1, M2 and V1 move (see MOVERS below).
  p('R3a', false, 2.5, 11.4, -106, 4, 4), // checkpoint 4: a rest stop between the drifting stones and the lift
  p('G3', false, 2.5, 14.8, -118, 6, 6), // the golden gate
];

/** A platform that slides back and forth along a straight line. Positions are the centre of its TOP surface. */
export interface MoverDef {
  id: string;
  /** Hidden movers are only solid while lit, exactly like hidden platforms. */
  hidden: boolean;
  from: { x: number; topY: number; z: number };
  to: { x: number; topY: number; z: number };
  w: number;
  d: number;
  /** Metres per second while travelling. */
  speed: number;
  /** Seconds it waits at each end. */
  pause: number;
  /** Seconds added to the clock, so neighbouring movers are out of step with each other. */
  phase: number;
}

/**
 * Room 3. M1 and M2 drift sideways across the gap (M2 is dark: light it to make it solid).
 * V1 is a lift: it only reaches the gate's height at the top of its ride.
 */
export const MOVERS: readonly MoverDef[] = [
  { id: 'M1', hidden: false, from: { x: 2.5, topY: 10.2, z: -94.5 }, to: { x: -5.5, topY: 10.2, z: -94.5 }, w: 3, d: 3, speed: 2.4, pause: 1.2, phase: 0 },
  { id: 'M2', hidden: true, from: { x: -5.5, topY: 10.8, z: -100 }, to: { x: 2.5, topY: 10.8, z: -100 }, w: 3, d: 3, speed: 2.4, pause: 1.2, phase: 1 },
  { id: 'V1', hidden: false, from: { x: 2.5, topY: 11.4, z: -111.5 }, to: { x: 2.5, topY: 14.2, z: -111.5 }, w: 3, d: 3, speed: 1.4, pause: 1.5, phase: 0 },
];

/** Order the player is expected to travel. */
export const ROUTE: readonly string[] = ['S', 'A', 'B', 'H1', 'H2', 'H3', 'C1', 'H4', 'H5', 'H6', 'G', 'R2a', 'L1', 'L2', 'L3', 'G2'];

/** Room 3 route. Entries may be static platforms (PLATFORMS) or movers (MOVERS). */
export const ROUTE_3: readonly string[] = ['G2', 'M1', 'M2', 'R3a', 'V1', 'G3'];

export function platformBox(d: PlatformDef): Box {
  return {
    min: { x: d.cx - d.w / 2, y: d.topY - PLATFORM_THICKNESS, z: d.cz - d.d / 2 },
    max: { x: d.cx + d.w / 2, y: d.topY, z: d.cz + d.d / 2 },
  };
}

export function platformById(id: string): PlatformDef {
  const found = PLATFORMS.find((q) => q.id === id);
  if (!found) throw new Error(`Unknown platform ${id}`);
  return found;
}

/** Player centre position when standing at the start (feet on top of S). */
export const SPAWN: Readonly<Vec3> = { x: 0, y: 0.92, z: 2 };

/** Falling below this height respawns the player. */
export const KILL_Y = -20;

export interface TriggerDef {
  id: string;
  /** Point on top of the platform at the trigger's centre. */
  x: number;
  y: number;
  z: number;
  radius: number;
}

export const CHECKPOINTS: readonly TriggerDef[] = [
  { id: 'C1', x: -4, y: 3.6, z: -37.5, radius: 2.6 },
  { id: 'C2', x: 2.5, y: 6.6, z: -57, radius: 2.6 },
  { id: 'C3', x: 2.5, y: 9.6, z: -88, radius: 2.6 },
  { id: 'C4', x: 2.5, y: 11.4, z: -106, radius: 1.8 },
];
export const GOAL: TriggerDef = { id: 'GOAL', x: 2.5, y: 14.8, z: -118, radius: 1.8 };

/** A beacon crystal: a pulse fired close enough wakes it and permanently reveals `unlocks`. */
export interface BeaconDef {
  id: string;
  /** Point on top of the platform it stands on. The crystal floats 1.2 m above. */
  x: number;
  y: number;
  z: number;
  unlocks: readonly string[];
}

export const BEACONS: readonly BeaconDef[] = [{ id: 'B1', x: -4.5, y: 7.8, z: -67.5, unlocks: ['L1', 'L2', 'L3'] }];

/** How close the lantern must be when you pulse (metres). Smaller than the pulse radius on purpose. */
export const BEACON_RANGE = 4.5;

export function pulseReaches(b: BeaconDef, lanternPos: Vec3): boolean {
  return Math.hypot(lanternPos.x - b.x, lanternPos.y - (b.y + 1.2), lanternPos.z - b.z) <= BEACON_RANGE;
}

/** Is a player whose feet are at `feet` standing inside this trigger? */
export function inTrigger(feet: Vec3, t: TriggerDef, height = 3): boolean {
  const dx = feet.x - t.x;
  const dz = feet.z - t.z;
  return dx * dx + dz * dz <= t.radius * t.radius && feet.y >= t.y - 0.6 && feet.y <= t.y + height;
}

/**
 * Which platform are these feet standing on? Returns its id, or null if in mid-air.
 * `margin` allows hanging slightly over the edge (the player is 0.7 m wide).
 */
export function platformUnder(feet: Vec3, defs: readonly PlatformDef[], margin = 0.35): string | null {
  for (const d of defs) {
    if (
      Math.abs(feet.y - d.topY) < 0.06 &&
      Math.abs(feet.x - d.cx) <= d.w / 2 + margin &&
      Math.abs(feet.z - d.cz) <= d.d / 2 + margin
    ) {
      return d.id;
    }
  }
  return null;
}

/** Where to put the player's centre when respawning at a point on top of a platform. */
export function respawnPosition(top: Vec3): Vec3 {
  return { x: top.x, y: top.y + 0.92, z: top.z };
}
