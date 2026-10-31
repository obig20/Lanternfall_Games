import { describe, expect, it } from 'vitest';
import { LifetimeStats, formatPlaytime, sanitizeTotals } from '../src/core/LifetimeStats';
import { MemoryStore } from '../src/core/storage';

describe('formatPlaytime', () => {
  it('uses seconds under a minute', () => {
    expect(formatPlaytime(0)).toBe('0s');
    expect(formatPlaytime(45.9)).toBe('45s');
  });

  it('uses minutes under an hour', () => {
    expect(formatPlaytime(60)).toBe('1m');
    expect(formatPlaytime(12 * 60 + 59)).toBe('12m');
    expect(formatPlaytime(59 * 60 + 59)).toBe('59m');
  });

  it('uses hours and zero-padded minutes after that', () => {
    expect(formatPlaytime(3600)).toBe('1h 00m');
    expect(formatPlaytime(3600 + 5 * 60)).toBe('1h 05m');
    expect(formatPlaytime(26 * 3600 + 30 * 60)).toBe('26h 30m');
  });

  it('treats negative values as zero', () => {
    expect(formatPlaytime(-30)).toBe('0s');
  });
});

describe('sanitizeTotals', () => {
  it('returns zeros for garbage', () => {
    for (const bad of [null, undefined, 4, 'x', [], {}]) {
      expect(sanitizeTotals(bad)).toEqual({ runsStarted: 0, runsCompleted: 0, falls: 0, pulses: 0, seconds: 0 });
    }
  });

  it('keeps valid fields and zeroes bad ones individually', () => {
    const t = sanitizeTotals({ runsStarted: 3, falls: -2, pulses: 'many', seconds: NaN, runsCompleted: 1 });
    expect(t).toEqual({ runsStarted: 3, runsCompleted: 1, falls: 0, pulses: 0, seconds: 0 });
  });
});

describe('LifetimeStats', () => {
  it('starts at zero with an empty summary', () => {
    const s = new LifetimeStats(new MemoryStore());
    expect(s.get().falls).toBe(0);
    expect(s.summary()).toBe('');
  });

  it('adds up across calls', () => {
    const s = new LifetimeStats(new MemoryStore());
    s.add({ falls: 1 });
    s.add({ falls: 2, pulses: 4 });
    s.add({ seconds: 1.5 });
    s.add({ seconds: 2.5 });
    expect(s.get()).toMatchObject({ falls: 3, pulses: 4, seconds: 4 });
  });

  it('ignores negative, zero, NaN and infinite amounts', () => {
    const s = new LifetimeStats(new MemoryStore());
    s.add({ falls: -5, pulses: NaN, seconds: Infinity, runsStarted: 0 });
    expect(s.get()).toEqual({ runsStarted: 0, runsCompleted: 0, falls: 0, pulses: 0, seconds: 0 });
    expect(s.save()).toBe(false);
  });

  it('does not write until save, and only writes when something changed', () => {
    const mem = new MemoryStore();
    const s = new LifetimeStats(mem);
    s.add({ falls: 1 });
    expect(mem.getItem('lanternfall.lifetime')).toBeNull();
    expect(s.save()).toBe(true);
    expect(mem.getItem('lanternfall.lifetime')).not.toBeNull();
    expect(s.save()).toBe(false);
  });

  it('reloads saved totals in a new session and keeps adding', () => {
    const mem = new MemoryStore();
    const a = new LifetimeStats(mem);
    a.add({ falls: 4, seconds: 90 });
    a.save();
    const b = new LifetimeStats(mem);
    expect(b.get()).toMatchObject({ falls: 4, seconds: 90 });
    b.add({ falls: 1 });
    expect(b.get().falls).toBe(5);
  });

  it('survives corrupt saved data', () => {
    const mem = new MemoryStore();
    mem.setItem('lanternfall.lifetime', '{oops');
    expect(new LifetimeStats(mem).get().seconds).toBe(0);
  });

  it('summary reads naturally', () => {
    const s = new LifetimeStats(new MemoryStore());
    s.add({ seconds: 125, falls: 7, runsStarted: 3, runsCompleted: 1 });
    expect(s.summary()).toBe('2m played  ·  7 falls  ·  1 of 3 runs finished');
  });
});
