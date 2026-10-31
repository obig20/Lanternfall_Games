import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS, AchievementBook, AchievementDef, FAST_TIME, FEW_PULSES, PERSISTENT_FALLS,
  QUICK_TIME, RunSummary, VETERAN_RUNS, sanitizeEarned,
} from '../src/core/Achievements';
import { MemoryStore } from '../src/core/storage';

const run = (patch: Partial<RunSummary> = {}): RunSummary => ({ time: 200, falls: 4, pulses: 8, totalRuns: 1, ...patch });
const ids = (list: AchievementDef[]): string[] => list.map((d) => d.id).sort();

describe('ACHIEVEMENTS data', () => {
  it('has unique ids with a title and description each', () => {
    const all = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(all).size).toBe(all.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(2);
      expect(a.description.length).toBeGreaterThan(8);
    }
  });

  it('time targets are ordered: lightning is stricter than quick', () => {
    expect(FAST_TIME).toBeLessThan(QUICK_TIME);
  });
});

describe('AchievementBook.evaluate', () => {
  it('an ordinary finish only earns first light', () => {
    const book = new AchievementBook(new MemoryStore());
    expect(ids(book.evaluate(run()))).toEqual(['first-light']);
  });

  it('flawless needs exactly zero falls', () => {
    expect(ids(new AchievementBook(new MemoryStore()).evaluate(run({ falls: 0 })))).toContain('flawless');
    expect(ids(new AchievementBook(new MemoryStore()).evaluate(run({ falls: 1 })))).not.toContain('flawless');
  });

  it('time achievements use strict less-than', () => {
    const at = (time: number): string[] => ids(new AchievementBook(new MemoryStore()).evaluate(run({ time })));
    expect(at(QUICK_TIME)).not.toContain('quick');
    expect(at(QUICK_TIME - 0.1)).toContain('quick');
    expect(at(FAST_TIME)).not.toContain('fast');
    expect(at(FAST_TIME - 0.1)).toContain('fast');
  });

  it('a very fast run earns both time achievements', () => {
    const got = ids(new AchievementBook(new MemoryStore()).evaluate(run({ time: 60 })));
    expect(got).toContain('quick');
    expect(got).toContain('fast');
  });

  it('frugal allows up to the limit', () => {
    const at = (pulses: number): string[] => ids(new AchievementBook(new MemoryStore()).evaluate(run({ pulses })));
    expect(at(FEW_PULSES)).toContain('frugal');
    expect(at(FEW_PULSES + 1)).not.toContain('frugal');
  });

  it('persistent and veteran trigger at their thresholds', () => {
    const f = (falls: number): string[] => ids(new AchievementBook(new MemoryStore()).evaluate(run({ falls })));
    expect(f(PERSISTENT_FALLS - 1)).not.toContain('persistent');
    expect(f(PERSISTENT_FALLS)).toContain('persistent');
    const r = (totalRuns: number): string[] => ids(new AchievementBook(new MemoryStore()).evaluate(run({ totalRuns })));
    expect(r(VETERAN_RUNS - 1)).not.toContain('veteran');
    expect(r(VETERAN_RUNS)).toContain('veteran');
  });

  it('only reports achievements the first time they are earned', () => {
    const book = new AchievementBook(new MemoryStore());
    expect(book.evaluate(run({ falls: 0 })).length).toBeGreaterThan(0);
    expect(book.evaluate(run({ falls: 0 }))).toEqual([]);
  });

  it('counts what has been earned', () => {
    const book = new AchievementBook(new MemoryStore());
    expect(book.count).toBe(0);
    book.evaluate(run({ falls: 0 }));
    expect(book.count).toBe(2);
    expect(book.total).toBe(ACHIEVEMENTS.length);
    expect(book.has('flawless')).toBe(true);
    expect(book.has('fast')).toBe(false);
  });
});

describe('AchievementBook persistence', () => {
  it('remembers achievements between sessions', () => {
    const mem = new MemoryStore();
    new AchievementBook(mem).evaluate(run({ falls: 0 }));
    const again = new AchievementBook(mem);
    expect(again.has('flawless')).toBe(true);
    expect(again.evaluate(run({ falls: 0 }))).toEqual([]);
  });

  it('survives corrupt data and drops ids that no longer exist', () => {
    const mem = new MemoryStore();
    mem.setItem('lanternfall.achievements', '{nope');
    expect(new AchievementBook(mem).count).toBe(0);
    mem.setItem('lanternfall.achievements', JSON.stringify(['flawless', 'removed-long-ago', 5, null]));
    const book = new AchievementBook(mem);
    expect(book.count).toBe(1);
    expect(book.has('flawless')).toBe(true);
  });

  it('works with a custom list of achievements', () => {
    const custom: AchievementDef[] = [{ id: 'x', title: 'Ex ex', description: 'always earned', earned: () => true }];
    const book = new AchievementBook(new MemoryStore(), custom);
    expect(ids(book.evaluate(run()))).toEqual(['x']);
    expect(book.total).toBe(1);
  });

  it('sanitizeEarned ignores non-arrays', () => {
    expect(sanitizeEarned('x')).toEqual([]);
    expect(sanitizeEarned({})).toEqual([]);
    expect(sanitizeEarned(['a', 1])).toEqual(['a']);
  });
});
