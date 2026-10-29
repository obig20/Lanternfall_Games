import { describe, expect, it } from 'vitest';
import { Box } from '../src/physics/aabb';
import { LANTERN, Lantern, RevealTracker, isLit } from '../src/world/LightReveal';

const box: Box = { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 1, z: 2 } };
const at = (x: number, y = 0.5, z = 1) => ({ x, y, z });

describe('isLit', () => {
  it('is lit inside the radius and unlit outside', () => {
    expect(isLit(box, at(2 + 2.9), 3)).toBe(true);
    expect(isLit(box, at(2 + 3.1), 3)).toBe(false);
  });
  it('is lit when the lantern is inside the box', () => {
    expect(isLit(box, at(1), 0.1)).toBe(true);
  });
  it('measures to the nearest point of the box, not its centre', () => {
    // Centre is 4 away, but the near face is only 3 away.
    expect(isLit(box, at(5), 3)).toBe(true);
  });
});

describe('Lantern pulse', () => {
  it('starts with the held radius', () => {
    expect(new Lantern().radius).toBe(LANTERN.heldRadius);
  });
  it('pulse enlarges the radius, then returns to normal', () => {
    const l = new Lantern();
    expect(l.tryPulse()).toBe(true);
    expect(l.radius).toBe(LANTERN.pulseRadius);
    l.update(LANTERN.pulseDuration + 0.01);
    expect(l.radius).toBe(LANTERN.heldRadius);
  });
  it('cannot pulse again until the cooldown ends', () => {
    const l = new Lantern();
    l.tryPulse();
    l.update(1);
    expect(l.tryPulse()).toBe(false);
    l.update(LANTERN.pulseCooldown);
    expect(l.ready).toBe(true);
    expect(l.tryPulse()).toBe(true);
  });
});

describe('RevealTracker', () => {
  const hidden = [{ id: 'P', box }];

  it('reveals once when the light arrives', () => {
    const t = new RevealTracker();
    expect(t.update(0.016, hidden, at(10), 3).revealed).toEqual([]);
    expect(t.isSolid('P')).toBe(false);
    expect(t.update(0.016, hidden, at(4), 3).revealed).toEqual(['P']);
    expect(t.isSolid('P')).toBe(true);
    expect(t.update(0.016, hidden, at(4), 3).revealed).toEqual([]);
  });

  it('stays solid for the linger time after the light leaves, then hides', () => {
    const t = new RevealTracker();
    t.update(0.016, hidden, at(4), 3);
    t.update(LANTERN.linger * 0.5, hidden, at(20), 3);
    expect(t.isSolid('P')).toBe(true);
    const change = t.update(LANTERN.linger, hidden, at(20), 3);
    expect(change.hidden).toEqual(['P']);
    expect(t.isSolid('P')).toBe(false);
  });

  it('fades visibility only near the end of the linger', () => {
    const t = new RevealTracker();
    t.update(0.016, hidden, at(4), 3);
    expect(t.visibility('P')).toBe(1);
    t.update(LANTERN.linger * 0.8, hidden, at(20), 3);
    expect(t.visibility('P') < 1).toBe(true);
    expect(t.visibility('P') > 0).toBe(true);
  });

  it('locked platforms ignore light until unlocked, and unlock survives reset()', () => {
    const t = new RevealTracker();
    const locked = [{ id: 'L', box, locked: true }];
    t.update(0.016, locked, at(1), 50);
    expect(t.isSolid('L')).toBe(false);
    expect(t.unlock(['L'])).toEqual(['L']);
    expect(t.isSolid('L')).toBe(true);
    expect(t.visibility('L')).toBe(1);
    t.reset();
    expect(t.isSolid('L')).toBe(true);
    t.clearPins();
    expect(t.isSolid('L')).toBe(false);
  });

  it('reset hides everything', () => {
    const t = new RevealTracker();
    t.update(0.016, hidden, at(4), 3);
    t.reset();
    expect(t.isSolid('P')).toBe(false);
  });
});
