import { describe, expect, it } from 'vitest';
import { SplitBook, formatDelta } from '../src/core/Splits';
import { MemoryStore } from '../src/core/storage';

describe('formatDelta', () => {
  it('shows a plus for slower and a minus for faster', () => {
    expect(formatDelta(1.26)).toBe('+1.3s');
    expect(formatDelta(-0.44)).toBe('-0.4s');
  });

  it('never shows "-0.0s"', () => {
    expect(formatDelta(-0.01)).toBe('+0.0s');
    expect(formatDelta(0)).toBe('+0.0s');
  });

  it('handles minutes worth of seconds', () => {
    expect(formatDelta(75.04)).toBe('+75.0s');
  });
});

describe('SplitBook.sanitize', () => {
  it('pads, trims and cleans to the requested length', () => {
    expect(SplitBook.sanitize([5, 'x', -1, 9, 10], 4)).toEqual([5, null, null, 9]);
    expect(SplitBook.sanitize([5], 3)).toEqual([5, null, null]);
    expect(SplitBook.sanitize('nope', 2)).toEqual([null, null]);
    expect(SplitBook.sanitize([NaN, Infinity, 0], 3)).toEqual([null, null, null]);
  });
});

describe('SplitBook', () => {
  it('the first split has no delta and counts as best', () => {
    const b = new SplitBook(new MemoryStore(), 3);
    expect(b.record(0, 30)).toEqual({ time: 30, delta: null, isBest: true });
    expect(b.bestFor(0)).toBe(30);
  });

  it('a faster time beats the old best and reports the gap', () => {
    const b = new SplitBook(new MemoryStore(), 3);
    b.record(1, 50);
    const r = b.record(1, 46.5);
    expect(r?.isBest).toBe(true);
    expect(r?.delta).toBeCloseTo(-3.5);
    expect(b.bestFor(1)).toBe(46.5);
  });

  it('a slower time reports a positive delta and keeps the best', () => {
    const b = new SplitBook(new MemoryStore(), 3);
    b.record(2, 40);
    const r = b.record(2, 43);
    expect(r?.isBest).toBe(false);
    expect(r?.delta).toBeCloseTo(3);
    expect(b.bestFor(2)).toBe(40);
  });

  it('ignores invalid input without changing anything', () => {
    const b = new SplitBook(new MemoryStore(), 2);
    expect(b.record(-1, 10)).toBeNull();
    expect(b.record(2, 10)).toBeNull();
    expect(b.record(0.5, 10)).toBeNull();
    expect(b.record(0, 0)).toBeNull();
    expect(b.record(0, NaN)).toBeNull();
    expect(b.bestFor(0)).toBeNull();
  });

  it('persists bests across instances and survives corrupt data', () => {
    const store = new MemoryStore();
    new SplitBook(store, 3).record(0, 12);
    expect(new SplitBook(store, 3).bestFor(0)).toBe(12);
    store.setItem('lanternfall.splits', '{bad json');
    expect(new SplitBook(store, 3).bestFor(0)).toBeNull();
  });

  it('bestFor is null for unknown indices', () => {
    const b = new SplitBook(new MemoryStore(), 2);
    expect(b.bestFor(5)).toBeNull();
    expect(b.bestFor(-1)).toBeNull();
  });
});
