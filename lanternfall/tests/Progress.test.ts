import { describe, expect, it } from 'vitest';
import { ProgressStore } from '../src/core/Progress';
import { MemoryStore } from '../src/core/storage';

const COUNT = 4;

describe('ProgressStore.sanitize', () => {
  it('returns -1 for missing or malformed data', () => {
    for (const bad of [null, undefined, 3, 'x', [], {}, { furthest: 'a' }, { furthest: 1.5 }, { furthest: NaN }]) {
      expect(ProgressStore.sanitize(bad, COUNT)).toBe(-1);
    }
  });

  it('rejects indices outside the tower', () => {
    expect(ProgressStore.sanitize({ furthest: -2 }, COUNT)).toBe(-1);
    expect(ProgressStore.sanitize({ furthest: COUNT }, COUNT)).toBe(-1);
    expect(ProgressStore.sanitize({ furthest: 99 }, COUNT)).toBe(-1);
  });

  it('keeps a valid index', () => {
    expect(ProgressStore.sanitize({ furthest: 0 }, COUNT)).toBe(0);
    expect(ProgressStore.sanitize({ furthest: COUNT - 1 }, COUNT)).toBe(COUNT - 1);
  });
});

describe('ProgressStore', () => {
  it('starts with nothing to continue', () => {
    const p = new ProgressStore(new MemoryStore(), COUNT);
    expect(p.canContinue).toBe(false);
    expect(p.furthestCheckpoint).toBe(-1);
  });

  it('only moves forward', () => {
    const p = new ProgressStore(new MemoryStore(), COUNT);
    expect(p.reach(1)).toBe(true);
    expect(p.reach(0)).toBe(false);
    expect(p.reach(1)).toBe(false);
    expect(p.reach(2)).toBe(true);
    expect(p.furthestCheckpoint).toBe(2);
  });

  it('ignores invalid indices without changing anything', () => {
    const p = new ProgressStore(new MemoryStore(), COUNT);
    p.reach(1);
    expect(p.reach(-1)).toBe(false);
    expect(p.reach(COUNT)).toBe(false);
    expect(p.reach(0.5)).toBe(false);
    expect(p.furthestCheckpoint).toBe(1);
  });

  it('persists across instances sharing a store', () => {
    const store = new MemoryStore();
    new ProgressStore(store, COUNT).reach(2);
    const again = new ProgressStore(store, COUNT);
    expect(again.canContinue).toBe(true);
    expect(again.furthestCheckpoint).toBe(2);
  });

  it('clear forgets progress and persists that', () => {
    const store = new MemoryStore();
    const p = new ProgressStore(store, COUNT);
    p.reach(3);
    p.clear();
    expect(p.canContinue).toBe(false);
    expect(new ProgressStore(store, COUNT).canContinue).toBe(false);
  });

  it('survives corrupt stored JSON', () => {
    const store = new MemoryStore();
    store.setItem('lanternfall.progress', '{not json');
    expect(new ProgressStore(store, COUNT).canContinue).toBe(false);
  });

  it('drops saved progress that no longer fits a smaller tower', () => {
    const store = new MemoryStore();
    new ProgressStore(store, 6).reach(5);
    expect(new ProgressStore(store, 4).canContinue).toBe(false);
  });
});
