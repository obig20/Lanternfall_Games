import { NEUTRAL_PAD, PadEdges, PadState, readPad } from './GamepadMap';
import { Action, Bindings, DEFAULT_BINDINGS } from './Keybinds';

/** Which action each gamepad button triggers. The pad is not rebindable, but it follows the keyboard layout. */
const PAD_ACTIONS = { jump: 'jump', pulse: 'pulse', restart: 'restart', pause: 'pause' } as const;

/** Keyboard and gamepad state. `down` = held; `pressed` = went down this frame. */
export class Input {
  private held = new Set<string>();
  private justDown = new Set<string>();
  /** Latest gamepad reading (neutral when no pad is connected). */
  pad: PadState = { ...NEUTRAL_PAD };
  private readonly padEdges = new PadEdges();
  /** The player's keyboard layout. Set by the game; defaults to WASD. */
  bindings: Bindings = DEFAULT_BINDINGS;
  private static readonly BLOCKED = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  down(code: string): boolean {
    return this.held.has(code);
  }

  pressed(code: string): boolean {
    return this.justDown.has(code);
  }

  /** Is the key bound to this action held right now? */
  actionDown(action: Action): boolean {
    return this.held.has(this.bindings[action]);
  }

  /** Did the key bound to this action go down this frame? Escape always counts as pause. */
  actionPressed(action: Action): boolean {
    return this.justDown.has(this.bindings[action]) || (action === 'pause' && this.justDown.has('Escape'));
  }

  /**
   * Read the first connected gamepad. Call once per frame before reading input.
   * Pad buttons are turned into the same key codes the keyboard uses, so game code
   * only has to ask `actionPressed('jump')` once.
   */
  pollPad(): void {
    const list = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const connected = Array.from(list).find((p) => p && p.connected) ?? null;
    this.pad = readPad(connected);
    for (const button of this.padEdges.update(this.pad)) this.justDown.add(this.bindings[PAD_ACTIONS[button]]);
  }

  /** Call once at the end of every frame. */
  endFrame(): void {
    this.justDown.clear();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (Input.BLOCKED.has(e.code)) e.preventDefault(); // stop page scrolling
    if (!e.repeat) this.justDown.add(e.code);
    this.held.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };
  private onBlur = (): void => {
    this.held.clear();
  };

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
