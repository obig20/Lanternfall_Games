/** Keyboard state. `down` = held; `pressed` = went down this frame. */
export class Input {
  private held = new Set<string>();
  private justDown = new Set<string>();
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
