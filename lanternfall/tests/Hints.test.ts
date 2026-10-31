import { describe, expect, it } from 'vitest';
import { HINTS, HintContext, HintDef, HintEngine } from '../src/core/Hints';
import { MemoryStore } from '../src/core/storage';

const base: HintContext = { platformId: null, pulsesFired: 0, fallsSinceCheckpoint: 0, secondsOnPlatform: 0 };
const ctx = (patch: Partial<HintContext>): HintContext => ({ ...base, ...patch });

describe('HINTS data', () => {
  it('has unique ids and non-empty text', () => {
    const ids = HINTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of HINTS) expect(h.text.length).toBeGreaterThan(10);
  });

  it('shows nothing while the player is simply in mid-air at the start', () => {
    for (const h of HINTS) expect(h.when(base)).toBe(false);
  });

  it('the pulse tip stops once the player has pulsed', () => {
    const pulse = HINTS.find((h) => h.id === 'pulse') as HintDef;
    expect(pulse.when(ctx({ platformId: 'H2', secondsOnPlatform: 2, pulsesFired: 0 }))).toBe(true);
    expect(pulse.when(ctx({ platformId: 'H2', secondsOnPlatform: 2, pulsesFired: 1 }))).toBe(false);
  });

  it('every platform-based tip waits a moment before appearing', () => {
    for (const id of ['H2', 'C1', 'R2a', 'G2', 'R3a']) {
      const early = HINTS.filter((h) => h.when(ctx({ platformId: id, secondsOnPlatform: 0.1 })));
      expect(early).toEqual([]);
    }
  });
});

describe('HintEngine', () => {
  const tips: HintDef[] = [
    { id: 'a', text: 'tip a is here', when: (c) => c.platformId === 'A' },
    { id: 'b', text: 'tip b is here', when: (c) => c.platformId === 'B' },
  ];

  it('returns the first matching hint, once', () => {
    const e = new HintEngine(new MemoryStore(), tips, { cooldown: 0 });
    expect(e.update(0.1, ctx({ platformId: 'A' }))?.id).toBe('a');
    expect(e.update(0.1, ctx({ platformId: 'A' }))).toBeNull();
    expect(e.hasSeen('a')).toBe(true);
  });

  it('waits for the cooldown between hints', () => {
    const e = new HintEngine(new MemoryStore(), tips, { cooldown: 5 });
    expect(e.update(0.1, ctx({ platformId: 'A' }))?.id).toBe('a');
    expect(e.update(2, ctx({ platformId: 'B' }))).toBeNull();
    expect(e.update(3.5, ctx({ platformId: 'B' }))?.id).toBe('b');
  });

  it('stays quiet when nothing matches', () => {
    const e = new HintEngine(new MemoryStore(), tips, { cooldown: 0 });
    expect(e.update(1, ctx({ platformId: 'Z' }))).toBeNull();
    expect(e.hasSeen('a')).toBe(false);
  });

  it('remembers seen hints between sessions', () => {
    const store = new MemoryStore();
    new HintEngine(store, tips, { cooldown: 0 }).update(1, ctx({ platformId: 'A' }));
    const again = new HintEngine(store, tips, { cooldown: 0 });
    expect(again.hasSeen('a')).toBe(true);
    expect(again.update(1, ctx({ platformId: 'A' }))).toBeNull();
  });

  it('ignores corrupt or wrongly typed saved data', () => {
    const store = new MemoryStore();
    store.setItem('lanternfall.hints', '{oops');
    expect(new HintEngine(store, tips).hasSeen('a')).toBe(false);
    store.setItem('lanternfall.hints', JSON.stringify(['a', 7, null, { x: 1 }]));
    const e = new HintEngine(store, tips);
    expect(e.hasSeen('a')).toBe(true);
    expect(HintEngine.sanitize('nope')).toEqual([]);
  });

  it('earlier hints in the list win when several match at once', () => {
    const both: HintDef[] = [
      { id: 'first', text: 'first tip text', when: () => true },
      { id: 'second', text: 'second tip text', when: () => true },
    ];
    const e = new HintEngine(new MemoryStore(), both, { cooldown: 0 });
    expect(e.update(1, base)?.id).toBe('first');
    expect(e.update(1, base)?.id).toBe('second');
  });

  it('shows the stuck tip after three falls even with the real hint list', () => {
    const e = new HintEngine(new MemoryStore());
    expect(e.update(1, ctx({ fallsSinceCheckpoint: 2 }))).toBeNull();
    expect(e.update(1, ctx({ fallsSinceCheckpoint: 3 }))?.id).toBe('stuck');
  });
});
