import { describe, expect, it } from 'vitest';
import {
  GHOST_INTERVAL, GHOST_MAX_POINTS, GHOST_SNAP_DISTANCE, GhostRecorder, GhostStore, GhostTrack,
  ghostDuration, pointCount, sampleGhost, sanitizeGhost,
} from '../src/core/Ghost';
import { MemoryStore } from '../src/core/storage';

const STEP = 1 / 60;
const at = (x: number, y = 0, z = 0) => ({ x, y, z });

/** A straight 1 m/s walk along +x with `n` samples. */
function walk(n: number): GhostTrack {
  const points: number[] = [];
  for (let i = 0; i < n; i++) points.push(Math.round(i * GHOST_INTERVAL * 100), 0, 0);
  return { interval: GHOST_INTERVAL, points };
}

describe('GhostRecorder', () => {
  it('takes a first sample immediately', () => {
    const r = new GhostRecorder();
    r.update(STEP, at(1, 2, 3));
    expect(r.sampleCount).toBe(1);
  });

  it('samples about ten times per second at 60 Hz', () => {
    const r = new GhostRecorder();
    for (let i = 0; i < 60; i++) r.update(STEP, at(i));
    expect(r.sampleCount).toBeGreaterThanOrEqual(10);
    expect(r.sampleCount).toBeLessThanOrEqual(11);
  });

  it('stores whole centimetres', () => {
    const r = new GhostRecorder();
    r.update(STEP, at(1.2349, 0.5, -2.004));
    const track = r.finish(at(0, 0, 0));
    expect(track?.points.slice(0, 3)).toEqual([123, 50, -200]);
  });

  it('finish keeps the end position as the last sample', () => {
    const r = new GhostRecorder();
    r.update(STEP, at(0));
    const track = r.finish(at(7, 1, 2));
    expect(track?.points.slice(-3)).toEqual([700, 100, 200]);
  });

  it('refuses a run with fewer than two samples', () => {
    const r = new GhostRecorder();
    expect(r.finish(at(0))).toBeNull();
  });

  it('reset clears a previous recording', () => {
    const r = new GhostRecorder();
    for (let i = 0; i < 30; i++) r.update(STEP, at(i));
    r.reset();
    expect(r.sampleCount).toBe(0);
    r.update(STEP, at(5));
    expect(r.sampleCount).toBe(1);
  });

  it('gives up on runs that are too long instead of growing forever', () => {
    const r = new GhostRecorder();
    for (let i = 0; i < GHOST_MAX_POINTS + 50; i++) r.update(GHOST_INTERVAL, at(i));
    expect(r.sampleCount).toBe(GHOST_MAX_POINTS);
    expect(r.finish(at(0))).toBeNull();
  });
});

describe('sanitizeGhost', () => {
  it('accepts a good track', () => {
    expect(sanitizeGhost(walk(5))).toEqual(walk(5));
  });

  it('rejects bad shapes', () => {
    const bad: unknown[] = [
      null, 3, 'x', [], {}, { interval: 0.1 }, { points: [1, 2, 3, 4, 5, 6] },
      { interval: 0.1, points: [1, 2, 3] },
      { interval: 0.1, points: [1, 2, 3, 4, 5] },
      { interval: 0.1, points: [1, 2, 3, 4, 5, 'x'] },
      { interval: 0.1, points: [1, 2, 3, 4, 5, NaN] },
      { interval: 0, points: [1, 2, 3, 4, 5, 6] },
      { interval: 99, points: [1, 2, 3, 4, 5, 6] },
      { interval: 0.1, points: new Array((GHOST_MAX_POINTS + 1) * 3).fill(0) },
    ];
    for (const b of bad) expect(sanitizeGhost(b)).toBeNull();
  });

  it('returns a copy, not the saved array', () => {
    const raw = walk(4);
    const out = sanitizeGhost(raw) as GhostTrack;
    out.points[0] = 999;
    expect(raw.points[0]).toBe(0);
  });
});

describe('sampleGhost', () => {
  it('reports counts and duration', () => {
    expect(pointCount(walk(11))).toBe(11);
    expect(ghostDuration(walk(11))).toBeCloseTo(1);
  });

  it('interpolates between samples', () => {
    const p = sampleGhost(walk(11), 0.25);
    expect(p.x).toBeCloseTo(0.25, 2);
  });

  it('waits at the start for negative time', () => {
    expect(sampleGhost(walk(11), -5).x).toBe(0);
  });

  it('stays at the finish after the run ends', () => {
    expect(sampleGhost(walk(11), 99).x).toBeCloseTo(1, 2);
  });

  it('snaps across a respawn instead of flying through the air', () => {
    const jump = (GHOST_SNAP_DISTANCE + 10) * 100;
    const track: GhostTrack = { interval: GHOST_INTERVAL, points: [0, 0, 0, jump, 0, 0, jump + 10, 0, 0] };
    expect(sampleGhost(track, 0.05).x).toBe(0);
    expect(sampleGhost(track, 0.1).x).toBeCloseTo(jump / 100, 2);
  });
});

describe('GhostStore', () => {
  it('starts empty, saves and reloads', () => {
    const mem = new MemoryStore();
    expect(new GhostStore(mem).load()).toBeNull();
    new GhostStore(mem).save(walk(6));
    expect(new GhostStore(mem).load()).toEqual(walk(6));
  });

  it('treats corrupt or invalid saved data as no ghost', () => {
    const mem = new MemoryStore();
    mem.setItem('lanternfall.ghost', '{broken');
    expect(new GhostStore(mem).load()).toBeNull();
    mem.setItem('lanternfall.ghost', JSON.stringify({ interval: 0.1, points: [1] }));
    expect(new GhostStore(mem).load()).toBeNull();
  });
});
