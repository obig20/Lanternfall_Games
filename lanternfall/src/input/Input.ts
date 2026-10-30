import { NEUTRAL_PAD, PadEdges, PadState, readPad } from './GamepadMap';

const PAD_KEYS = { jump: 'Space', pulse: 'KeyQ', restart: 'KeyR', pause: 'Escape' } as const;

/** Keyboard and gamepad state. `down` = held; `pressed` = went down this frame. */
export class Input {
  private held = new Set<string>();
  private justDown = new Set<string>();
  /** Latest gamepad reading (neutral when no pad is connected). */
  pad: PadState = { ...NEUTRAL_PAD };
  private readonly padEdges = new PadEdges();
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

  /**
   * Read the first connected gamepad. Call once per frame before reading input.
   * Pad buttons are turned into the same key codes the keyboard uses, so game code
   * only has to ask `pressed('Space')` once.
   */
  pollPad(): void {
    const list = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const connected = Array.from(list).find((p) => p && p.connected) ?? null;
    this.pad = readPad(connected);
    for (const button of this.padEdges.update(this.pad)) this.justDown.add(PAD_KEYS[button]);
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
