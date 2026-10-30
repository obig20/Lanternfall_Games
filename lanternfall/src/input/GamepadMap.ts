import { radialDeadzone, responseCurve } from './analog';

/** The parts of the browser Gamepad object we read (the "standard" layout). */
export interface PadSnapshot {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

export interface PadState {
  /** Left stick: +x is right, +z is FORWARD (stick pushed up). Length <= 1. */
  moveX: number;
  moveZ: number;
  /** Right stick, -1..1, +x turns right and +y looks down. */
  lookX: number;
  lookY: number;
  jump: boolean;
  pulse: boolean;
  restart: boolean;
  pause: boolean;
}

export const NEUTRAL_PAD: Readonly<PadState> = {
  moveX: 0, moveZ: 0, lookX: 0, lookY: 0, jump: false, pulse: false, restart: false, pause: false,
};

/** Standard-mapping button indices. */
export const PAD_BUTTONS = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, START: 9, DPAD_UP: 12 } as const;

const held = (pad: PadSnapshot, i: number): boolean => {
  const b = pad.buttons[i];
  return !!b && (b.pressed || b.value > 0.5);
};

/**
 * Turn one gamepad reading into game actions. A jumps, X or either trigger/bumper pulses the
 * lantern, Y goes back to the checkpoint, Start pauses. Missing axes/buttons read as neutral
 * so odd controllers cannot crash the game.
 */
export function readPad(pad: PadSnapshot | null): PadState {
  if (!pad) return { ...NEUTRAL_PAD };
  const axis = (i: number): number => (Number.isFinite(pad.axes[i]) ? pad.axes[i] : 0);
  const move = radialDeadzone(axis(0), axis(1), 0.2);
  const look = radialDeadzone(axis(2), axis(3), 0.15);
  return {
    moveX: move.x,
    moveZ: 0 - move.y, // stick "up" is negative on the Y axis (0 - x avoids producing -0)
    lookX: responseCurve(look.x),
    lookY: responseCurve(look.y),
    jump: held(pad, PAD_BUTTONS.A),
    pulse: held(pad, PAD_BUTTONS.X) || held(pad, PAD_BUTTONS.RT) || held(pad, PAD_BUTTONS.RB),
    restart: held(pad, PAD_BUTTONS.Y),
    pause: held(pad, PAD_BUTTONS.START),
  };
}

export type PadButton = 'jump' | 'pulse' | 'restart' | 'pause';
const BUTTONS: readonly PadButton[] = ['jump', 'pulse', 'restart', 'pause'];

/** Turns "held" into "went down this frame", like keyboard `pressed`. */
export class PadEdges {
  private previous: Record<PadButton, boolean> = { jump: false, pulse: false, restart: false, pause: false };

  /** Returns the buttons that went down since the last call. */
  update(state: PadState): PadButton[] {
    const fresh = BUTTONS.filter((b) => state[b] && !this.previous[b]);
    for (const b of BUTTONS) this.previous[b] = state[b];
    return fresh;
  }

  reset(): void {
    for (const b of BUTTONS) this.previous[b] = false;
  }
}
