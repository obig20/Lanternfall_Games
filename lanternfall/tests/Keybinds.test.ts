import { describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '../src/core/storage';
import {
  ACTIONS, ACTION_LABELS, Action, BindingStore, DEFAULT_BINDINGS, RESERVED_CODES,
  isBindableCode, keyLabel, rebind, sanitizeBindings,
} from '../src/input/Keybinds';

describe('defaults', () => {
  it('give every action exactly one unique, bindable key and a label', () => {
    const codes = ACTIONS.map((a) => DEFAULT_BINDINGS[a]);
    expect(new Set(codes).size).toBe(ACTIONS.length);
    for (const a of ACTIONS) {
      expect(isBindableCode(DEFAULT_BINDINGS[a])).toBe(true);
      expect(ACTION_LABELS[a].length).toBeGreaterThan(3);
    }
  });

  it('keep the original layout: WASD, Space, Q, R, arrows', () => {
    expect(DEFAULT_BINDINGS).toMatchObject({
      forward: 'KeyW', left: 'KeyA', back: 'KeyS', right: 'KeyD', jump: 'Space', pulse: 'KeyQ', restart: 'KeyR',
      turnLeft: 'ArrowLeft', turnRight: 'ArrowRight',
    });
  });
});

describe('isBindableCode', () => {
  it('accepts normal key codes', () => {
    for (const c of ['KeyZ', 'Space', 'Digit4', 'ArrowUp', 'ShiftLeft', 'Numpad2']) expect(isBindableCode(c)).toBe(true);
  });

  it('rejects Escape, junk and non-strings', () => {
    for (const c of ['Escape', '', 'Key W', 'a-b', 'x'.repeat(40), 5, null, undefined, {}]) expect(isBindableCode(c)).toBe(false);
    expect(RESERVED_CODES.has('Escape')).toBe(true);
  });
});

describe('sanitizeBindings', () => {
  it('returns the defaults for garbage', () => {
    for (const bad of [null, undefined, 3, 'x', [], {}]) expect(sanitizeBindings(bad)).toEqual(DEFAULT_BINDINGS);
  });

  it('keeps a valid custom layout', () => {
    const custom = { ...DEFAULT_BINDINGS, jump: 'KeyJ' };
    expect(sanitizeBindings(custom)).toEqual(custom);
  });

  it('replaces a bad entry with its default', () => {
    expect(sanitizeBindings({ jump: 'Escape' }).jump).toBe('Space');
    expect(sanitizeBindings({ pulse: 42 }).pulse).toBe('KeyQ');
  });

  it('resets everything when two actions share a key', () => {
    const clash = { ...DEFAULT_BINDINGS, jump: 'KeyQ' };
    expect(sanitizeBindings(clash)).toEqual(DEFAULT_BINDINGS);
  });

  it('resets everything when a bad entry falls back onto a key another action now uses', () => {
    const tricky = { ...DEFAULT_BINDINGS, forward: 'KeyA', left: 'Escape' };
    expect(sanitizeBindings(tricky)).toEqual(DEFAULT_BINDINGS);
  });
});

describe('rebind', () => {
  it('moves an action to a free key', () => {
    const r = rebind(DEFAULT_BINDINGS, 'jump', 'KeyJ');
    expect(r?.bindings.jump).toBe('KeyJ');
    expect(r?.swapped).toBeNull();
  });

  it('swaps with the action that already owns the key', () => {
    const r = rebind(DEFAULT_BINDINGS, 'jump', 'KeyQ');
    expect(r?.bindings.jump).toBe('KeyQ');
    expect(r?.bindings.pulse).toBe('Space');
    expect(r?.swapped).toBe('pulse');
  });

  it('never leaves two actions on one key, whatever you rebind', () => {
    let b = DEFAULT_BINDINGS;
    const keys = ['KeyW', 'KeyQ', 'Space', 'KeyA', 'KeyM', 'KeyZ', 'ArrowLeft', 'KeyD'];
    for (let i = 0; i < 40; i++) {
      const action = ACTIONS[i % ACTIONS.length] as Action;
      const r = rebind(b, action, keys[i % keys.length]);
      if (r) b = r.bindings;
      expect(new Set(ACTIONS.map((a) => b[a])).size).toBe(ACTIONS.length);
    }
  });

  it('is a no-op when the key is unchanged', () => {
    const r = rebind(DEFAULT_BINDINGS, 'jump', 'Space');
    expect(r?.bindings).toBe(DEFAULT_BINDINGS);
    expect(r?.swapped).toBeNull();
  });

  it('refuses Escape and invalid codes', () => {
    expect(rebind(DEFAULT_BINDINGS, 'jump', 'Escape')).toBeNull();
    expect(rebind(DEFAULT_BINDINGS, 'jump', 'not a key')).toBeNull();
  });

  it('does not change the bindings it was given', () => {
    const before = { ...DEFAULT_BINDINGS };
    rebind(DEFAULT_BINDINGS, 'jump', 'KeyQ');
    expect(DEFAULT_BINDINGS).toEqual(before);
  });
});

describe('keyLabel', () => {
  it('shortens letters, digits and arrows', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit7')).toBe('7');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('ArrowDown')).toBe('↓');
    expect(keyLabel('Numpad3')).toBe('Num 3');
  });

  it('spaces out left/right modifiers and leaves others alone', () => {
    expect(keyLabel('ShiftLeft')).toBe('Shift Left');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('Tab')).toBe('Tab');
  });
});

describe('BindingStore', () => {
  it('starts with the defaults', () => {
    expect(new BindingStore(new MemoryStore()).get()).toEqual(DEFAULT_BINDINGS);
  });

  it('saves a rebind and reloads it', () => {
    const mem = new MemoryStore();
    new BindingStore(mem).rebind('jump', 'KeyJ');
    expect(new BindingStore(mem).get().jump).toBe('KeyJ');
  });

  it('survives corrupt saved data', () => {
    const mem = new MemoryStore();
    mem.setItem('lanternfall.keys', '{nope');
    expect(new BindingStore(mem).get()).toEqual(DEFAULT_BINDINGS);
  });

  it('notifies listeners on change, not on a no-op, and stops after unsubscribe', () => {
    const s = new BindingStore(new MemoryStore());
    const fn = vi.fn();
    const off = s.onChange(fn);
    s.rebind('jump', 'KeyJ');
    expect(fn).toHaveBeenCalledTimes(1);
    s.rebind('jump', 'KeyJ');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.rebind('jump', 'KeyK');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reset restores the defaults', () => {
    const s = new BindingStore(new MemoryStore());
    s.rebind('jump', 'KeyJ');
    s.reset();
    expect(s.get()).toEqual(DEFAULT_BINDINGS);
  });

  it('returns null for a refused key and changes nothing', () => {
    const s = new BindingStore(new MemoryStore());
    expect(s.rebind('jump', 'Escape')).toBeNull();
    expect(s.get().jump).toBe('Space');
  });
});
