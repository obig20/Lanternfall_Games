import { describe, expect, it } from 'vitest';
import { Records, formatTime } from '../src/core/Records';
import { MemoryStore } from '../src/core/storage';

describe('Records', () => {
  it('has an empty record before any run', () => {
    expect(new Records(new MemoryStore()).get('tower')).toEqual({ bestTime: null, fewestFalls: null, runs: 0 });
  });

  it('the first run sets the record but is not "beating" anything', () => {
    const r = new Records(new MemoryStore());
    const out = r.submit('tower', { time: 100, falls: 4 });
    expect(out.beatPrevious).toBe(false);
    expect(out.newBestTime).toBe(false);
    expect(out.record).toEqual({ bestTime: 100, fewestFalls: 4, runs: 1 });
  });

  it('a faster run beats the time but a worse fall count does not replace the best', () => {
    const r = new Records(new MemoryStore());
    r.submit('tower', { time: 100, falls: 2 });
    const out = r.submit('tower', { time: 90, falls: 5 });
    expect(out.newBestTime).toBe(true);
    expect(out.newBestFalls).toBe(false);
    expect(out.record).toEqual({ bestTime: 90, fewestFalls: 2, runs: 2 });
  });

  it('a slower, clumsier run changes nothing but the run count', () => {
    const r = new Records(new MemoryStore());
    r.submit('tower', { time: 60, falls: 0 });
    const out = r.submit('tower', { time: 80, falls: 3 });
    expect(out.beatPrevious).toBe(false);
    expect(out.record).toEqual({ bestTime: 60, fewestFalls: 0, runs: 2 });
  });

  it('an equal time is not a new best', () => {
    const r = new Records(new MemoryStore());
    r.submit('tower', { time: 60, falls: 1 });
    expect(r.submit('tower', { time: 60, falls: 1 }).beatPrevious).toBe(false);
  });

  it('keeps separate records per run id and persists them', () => {
    const mem = new MemoryStore();
    new Records(mem).submit('a', { time: 10, falls: 0 });
    new Records(mem).submit('b', { time: 20, falls: 1 });
    const reloaded = new Records(mem);
    expect(reloaded.get('a').bestTime).toBe(10);
    expect(reloaded.get('b').bestTime).toBe(20);
  });

  it('ignores corrupt or tampered saved data', () => {
    const mem = new MemoryStore();
    mem.setItem('lanternfall.records', JSON.stringify({ tower: { bestTime: -5, fewestFalls: 1.5, runs: 'x' }, junk: 7 }));
    const r = new Records(mem);
    expect(r.get('tower')).toEqual({ bestTime: null, fewestFalls: null, runs: 0 });
    expect(r.get('junk')).toEqual({ bestTime: null, fewestFalls: null, runs: 0 });
    mem.setItem('lanternfall.records', 'not json');
    expect(r.get('tower').runs).toBe(0);
  });
});

describe('formatTime', () => {
  it('formats minutes, seconds and tenths', () => {
    expect(formatTime(0)).toBe('0:00.0');
    expect(formatTime(65.37)).toBe('1:05.3');
    expect(formatTime(600)).toBe('10:00.0');
  });

  it('never shows negative time', () => {
    expect(formatTime(-4)).toBe('0:00.0');
  });
});
