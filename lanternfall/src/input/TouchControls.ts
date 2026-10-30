import { stickVector } from './analog';

const STICK_RADIUS = 56; // pixels of finger travel for a full push

/**
 * On-screen controls for phones and tablets: a move stick (bottom-left), Jump and Pulse buttons
 * (bottom-right) and a pause button. Dragging anywhere else still turns the camera, because the
 * camera listens to the canvas directly.
 */
export class TouchControls {
  /** Current stick vector, +z is forward. Length <= 1. */
  moveX = 0;
  moveZ = 0;

  private jumpQueued = false;
  private pulseQueued = false;
  private stickId: number | null = null;
  private readonly root = document.createElement('div');
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly cleanups: Array<() => void> = [];

  /** True on devices with a touch screen. */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }

  constructor(parent: HTMLElement, onPause: () => void) {
    this.root.className = 'touch-controls hidden';
    this.root.innerHTML = `
      <div class="t-stick"><div class="t-knob"></div></div>
      <button class="t-btn t-jump" type="button">JUMP</button>
      <button class="t-btn t-pulse" type="button">PULSE</button>
      <button class="t-btn t-pause" type="button">II</button>
    `;
    parent.appendChild(this.root);
    this.base = this.root.querySelector('.t-stick') as HTMLElement;
    this.knob = this.root.querySelector('.t-knob') as HTMLElement;

    this.listen(this.base, 'pointerdown', this.onStickDown as EventListener);
    this.listen(this.base, 'pointermove', this.onStickMove as EventListener);
    this.listen(this.base, 'pointerup', this.onStickEnd as EventListener);
    this.listen(this.base, 'pointercancel', this.onStickEnd as EventListener);
    this.listen(this.root.querySelector('.t-jump') as HTMLElement, 'pointerdown', () => { this.jumpQueued = true; });
    this.listen(this.root.querySelector('.t-pulse') as HTMLElement, 'pointerdown', () => { this.pulseQueued = true; });
    this.listen(this.root.querySelector('.t-pause') as HTMLElement, 'pointerdown', () => onPause());
  }

  setVisible(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
    if (!on) this.release();
  }

  /** True once per jump-button press. */
  consumeJump(): boolean {
    const v = this.jumpQueued;
    this.jumpQueued = false;
    return v;
  }

  /** True once per pulse-button press. */
  consumePulse(): boolean {
    const v = this.pulseQueued;
    this.pulseQueued = false;
    return v;
  }

  private listen(el: HTMLElement, type: string, fn: EventListener): void {
    el.addEventListener(type, fn);
    this.cleanups.push(() => el.removeEventListener(type, fn));
  }

  private onStickDown = (e: PointerEvent): void => {
    if (this.stickId !== null) return;
    this.stickId = e.pointerId;
    this.base.setPointerCapture(e.pointerId);
    this.updateStick(e);
  };

  private onStickMove = (e: PointerEvent): void => {
    if (e.pointerId === this.stickId) this.updateStick(e);
  };

  private onStickEnd = (e: PointerEvent): void => {
    if (e.pointerId === this.stickId) this.release();
  };

  private updateStick(e: PointerEvent): void {
    const r = this.base.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const v = stickVector(dx, dy, STICK_RADIUS);
    this.moveX = v.x;
    this.moveZ = 0 - v.y; // finger up = forward
    this.knob.style.transform = `translate(${Math.max(-1, Math.min(1, dx / STICK_RADIUS)) * 36}px, ${Math.max(-1, Math.min(1, dy / STICK_RADIUS)) * 36}px)`;
  }

  private release(): void {
    this.stickId = null;
    this.moveX = 0;
    this.moveZ = 0;
    this.knob.style.transform = 'translate(0, 0)';
  }

  dispose(): void {
    for (const off of this.cleanups) off();
    this.root.remove();
  }
}
