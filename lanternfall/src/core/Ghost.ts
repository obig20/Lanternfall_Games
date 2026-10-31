import { Vec3 } from '../physics/aabb';
import { KeyValueStore, readJson } from './storage';

/** Seconds between two recorded positions. */
export const GHOST_INTERVAL = 0.1;
/** Most positions we keep (10 minutes of play). Longer runs get no ghost. */
export const GHOST_MAX_POINTS = 6000;
/** A jump bigger than this (metres) between two samples is a respawn: the ghost snaps instead of sliding through the air. */
export const GHOST_SNAP_DISTANCE = 5;

/** A recorded run: positions sampled at a fixed interval. */
export interface GhostTrack {
  interval: number;
  /** Flat [x, y, z, x, y, z, ...] in whole centimetres, which keeps the saved file small. */
  points: number[];
}

const toCm = (metres: number): number => Math.round(metres * 100);

export function pointCount(track: GhostTrack): number {
  return Math.floor(track.points.length / 3);
}

/** Length of the recorded run in seconds. */
export function ghostDuration(track: GhostTrack): number {
  return Math.max(0, pointCount(track) - 1) * track.interval;
}

/** Records the player's position at a steady rate while a run is in progress. */
export class GhostRecorder {
  private points: number[] = [];
  private clock = 0;
  private nextAt = 0;
  private overflowed = false;

  /** Start a new recording. */
  reset(): void {
    this.points = [];
    this.clock = 0;
    this.nextAt = 0;
    this.overflowed = false;
  }

  get sampleCount(): number {
    return Math.floor(this.points.length / 3);
  }

  /** Advance by `dt` seconds of run time; stores a sample whenever one is due. */
  update(dt: number, pos: Vec3): void {
    this.clock += dt;
    while (this.clock >= this.nextAt) {
      this.push(pos);
      this.nextAt += GHOST_INTERVAL;
    }
  }

  /** Finish the run at `end`. Null if the run was too short or too long to keep. */
  finish(end: Vec3): GhostTrack | null {
    this.push(end);
    if (this.overflowed || this.sampleCount < 2) return null;
    return { interval: GHOST_INTERVAL, points: [...this.points] };
  }

  private push(pos: Vec3): void {
    if (this.sampleCount >= GHOST_MAX_POINTS) {
      this.overflowed = true;
      return;
    }
    this.points.push(toCm(pos.x), toCm(pos.y), toCm(pos.z));
  }
}

/** Accept a saved track only if it is well formed; anything else (old saves, edited JSON) becomes null. */
export function sanitizeGhost(raw: unknown): GhostTrack | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { interval, points } = raw as Partial<GhostTrack>;
  if (typeof interval !== 'number' || !Number.isFinite(interval) || interval < 0.01 || interval > 1) return null;
  if (!Array.isArray(points) || points.length < 6 || points.length % 3 !== 0) return null;
  if (points.length > GHOST_MAX_POINTS * 3) return null;
  if (!points.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  return { interval, points: points.slice() };
}

function pointAt(track: GhostTrack, i: number): Vec3 {
  return { x: track.points[3 * i] / 100, y: track.points[3 * i + 1] / 100, z: track.points[3 * i + 2] / 100 };
}

/** Where the ghost is `t` seconds into its run. Before the start it waits; after the end it stays at the finish. */
export function sampleGhost(track: GhostTrack, t: number): Vec3 {
  const n = pointCount(track);
  const f = Math.max(0, t) / track.interval;
  const i = Math.floor(f);
  if (i >= n - 1) return pointAt(track, n - 1);
  const a = pointAt(track, i);
  const b = pointAt(track, i + 1);
  if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > GHOST_SNAP_DISTANCE) return a;
  const k = f - i;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}

/** Saves the ghost of the player's best run. */
export class GhostStore {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key = 'lanternfall.ghost',
  ) {}

  load(): GhostTrack | null {
    return sanitizeGhost(readJson(this.store, this.key));
  }

  save(track: GhostTrack): void {
    this.store.setItem(this.key, JSON.stringify(track));
  }
}
