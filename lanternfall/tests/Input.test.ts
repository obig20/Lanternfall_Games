import { describe, expect, it } from 'vitest';
import { radialDeadzone, responseCurve, stickVector } from '../src/input/analog';
import { NEUTRAL_PAD, PAD_BUTTONS, PadEdges, PadSnapshot, readPad } from '../src/input/GamepadMap';

const pad = (axes: number[], pressed: number[] = []): PadSnapshot => ({
  axes,
  buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
});

describe('radialDeadzone', () => {
  it('reads zero inside the deadzone', () => {
    expect(radialDeadzone(0.1, 0.1, 0.2)).toEqual({ x: 0, y: 0 });
    expect(radialDeadzone(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('reaches full length at the rim and never exceeds 1', () => {
    const full = radialDeadzone(1, 0);
    expect(full.x).toBeCloseTo(1);
    const over = radialDeadzone(3, 4);
    expect(Math.hypot(over.x, over.y)).toBeCloseTo(1);
  });

  it('has no jump at the edge of the deadzone', () => {
    const justOut = radialDeadzone(0.2001, 0, 0.2);
    expect(justOut.x).toBeLessThan(0.01);
  });

  it('keeps the direction of the push', () => {
    const v = radialDeadzone(0.6, -0.6);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeLessThan(0);
    expect(Math.abs(v.x + v.y)).toBeCloseTo(0);
  });

  it('treats NaN input as no input', () => {
    expect(radialDeadzone(NaN, 1)).toEqual({ x: 0, y: 0 });
  });
});

describe('stickVector and responseCurve', () => {
  it('scales finger distance by the stick radius', () => {
    const half = stickVector(30, 0, 60, 0);
    expect(half.x).toBeCloseTo(0.5);
    expect(stickVector(500, 0, 60).x).toBeCloseTo(1);
  });

  it('is safe with a zero radius', () => {
    expect(stickVector(10, 10, 0)).toEqual({ x: 0, y: 0 });
  });

  it('the response curve keeps the sign and is gentler near zero', () => {
    expect(responseCurve(-0.5)).toBeLessThan(0);
    expect(Math.abs(responseCurve(0.5))).toBeLessThan(0.5);
    expect(responseCurve(1)).toBeCloseTo(1);
    expect(responseCurve(0)).toBe(0);
  });
});

describe('readPad', () => {
  it('is neutral with no pad connected', () => {
    expect(readPad(null)).toEqual(NEUTRAL_PAD);
  });

  it('pushing the left stick up means forward', () => {
    expect(readPad(pad([0, -1])).moveZ).toBeCloseTo(1);
    expect(readPad(pad([1, 0])).moveX).toBeCloseTo(1);
  });

  it('ignores stick drift', () => {
    const s = readPad(pad([0.08, -0.05, 0.1, 0.1]));
    expect(s.moveX).toBe(0);
    expect(s.moveZ).toBe(0);
    expect(s.lookX).toBe(0);
  });

  it('maps buttons to actions', () => {
    expect(readPad(pad([], [PAD_BUTTONS.A])).jump).toBe(true);
    expect(readPad(pad([], [PAD_BUTTONS.X])).pulse).toBe(true);
    expect(readPad(pad([], [PAD_BUTTONS.RT])).pulse).toBe(true);
    expect(readPad(pad([], [PAD_BUTTONS.Y])).restart).toBe(true);
    expect(readPad(pad([], [PAD_BUTTONS.START])).pause).toBe(true);
    expect(readPad(pad([], [])).jump).toBe(false);
  });

  it('survives a controller with missing axes and buttons', () => {
    const odd: PadSnapshot = { axes: [], buttons: [] };
    expect(readPad(odd)).toEqual(NEUTRAL_PAD);
  });
});

describe('PadEdges', () => {
  it('reports a button once per press, not every frame', () => {
    const e = new PadEdges();
    const down = readPad(pad([], [PAD_BUTTONS.A]));
    expect(e.update(down)).toEqual(['jump']);
    expect(e.update(down)).toEqual([]);
    expect(e.update(readPad(pad([])))).toEqual([]);
    expect(e.update(down)).toEqual(['jump']);
  });

  it('reports several buttons pressed together', () => {
    const e = new PadEdges();
    const both = readPad(pad([], [PAD_BUTTONS.A, PAD_BUTTONS.X]));
    expect(e.update(both).sort()).toEqual(['jump', 'pulse']);
  });

  it('reset forgets held buttons', () => {
    const e = new PadEdges();
    const down = readPad(pad([], [PAD_BUTTONS.A]));
    e.update(down);
    e.reset();
    expect(e.update(down)).toEqual(['jump']);
  });
});
