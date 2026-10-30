import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, SETTING_LIMITS, SettingsStore, sanitizeSettings } from '../src/core/Settings';
import { KeyValueStore, MemoryStore, readJson } from '../src/core/storage';

describe('sanitizeSettings', () => {
  it('returns defaults for missing or non-object input', () => {
    for (const bad of [null, undefined, 42, 'x', [], true]) {
      expect(sanitizeSettings(bad)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('clamps out-of-range numbers', () => {
    const s = sanitizeSettings({ volume: 7, sensitivity: -3 });
    expect(s.volume).toBe(SETTING_LIMITS.volume.max);
    expect(s.sensitivity).toBe(SETTING_LIMITS.sensitivity.min);
  });

  it('rejects NaN, Infinity and wrong types field by field', () => {
    const s = sanitizeSettings({ volume: NaN, sensitivity: '2', invertY: 'yes' });
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ volume: Infinity }).volume).toBe(DEFAULT_SETTINGS.volume);
  });

  it('keeps valid fields even when others are bad', () => {
    expect(sanitizeSettings({ volume: 0.2, invertY: true, sensitivity: 'fast' })).toEqual({
      volume: 0.2, sensitivity: DEFAULT_SETTINGS.sensitivity, invertY: true,
    });
  });
});

describe('SettingsStore', () => {
  it('starts with defaults on an empty store', () => {
    expect(new SettingsStore(new MemoryStore()).get()).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and reloads', () => {
    const mem = new MemoryStore();
    new SettingsStore(mem).set({ volume: 0.9, invertY: true });
    const again = new SettingsStore(mem).get();
    expect(again.volume).toBe(0.9);
    expect(again.invertY).toBe(true);
  });

  it('survives corrupt saved data', () => {
    const mem = new MemoryStore();
    mem.setItem('lanternfall.settings', '{not json');
    expect(new SettingsStore(mem).get()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges partial updates and clamps them', () => {
    const s = new SettingsStore(new MemoryStore());
    s.set({ sensitivity: 100 });
    expect(s.get().sensitivity).toBe(SETTING_LIMITS.sensitivity.max);
    expect(s.get().volume).toBe(DEFAULT_SETTINGS.volume);
  });

  it('notifies listeners and stops after unsubscribe', () => {
    const s = new SettingsStore(new MemoryStore());
    const fn = vi.fn();
    const off = s.onChange(fn);
    s.set({ volume: 0.1 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].volume).toBe(0.1);
    off();
    s.set({ volume: 0.2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reset restores defaults', () => {
    const s = new SettingsStore(new MemoryStore());
    s.set({ volume: 0, invertY: true });
    expect(s.reset()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('storage helpers', () => {
  it('readJson returns null for missing and corrupt values', () => {
    const mem = new MemoryStore();
    expect(readJson(mem, 'nope')).toBe(null);
    mem.setItem('bad', '{{');
    expect(readJson(mem, 'bad')).toBe(null);
    mem.setItem('ok', '{"a":1}');
    expect(readJson(mem, 'ok')).toEqual({ a: 1 });
  });

  it('a store that throws on write does not crash settings in the caller', () => {
    const angry: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    const s = new SettingsStore(angry);
    expect(() => s.set({ volume: 0.3 })).toThrow(); // browserStore() is what swallows this; the raw store may throw
  });
});
