import * as THREE from 'three';
import { Box } from '../physics/aabb';
import { clipRay } from '../physics/raycast';

/**
 * Camera that follows the player from behind and above.
 * Drag the mouse or use the Left/Right arrows to rotate it; scroll to zoom.
 * The yaw angle also defines which way "forward" is for WASD.
 */
export class ThirdPersonCamera {
  yaw = 0; // 0 = camera sits on the +Z side, looking toward -Z (the route direction)
  private pitch = 0.42;
  private distance = 8.5;
  private dragging = false;
  private readonly focus = new THREE.Vector3();
  private readonly smoothPos = new THREE.Vector3();
  private initialised = false;
  /** Smoothed distance after wall clipping: pulls in instantly, eases back out. */
  private clipDist = Infinity;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly dom: HTMLElement,
  ) {
    dom.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointermove', this.onMove);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** Ground-plane direction the camera is looking (what "W" means). */
  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  right(): { x: number; z: number } {
    return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
  }

  rotate(delta: number): void {
    this.yaw += delta;
  }

  /** Follow `target` (the player's centre). `obstacles` keep the camera from pushing through platforms. */
  update(dt: number, target: THREE.Vector3, obstacles: readonly Box[] = []): void {
    this.focus.set(target.x, target.y + 0.6, target.z);
    const cp = Math.cos(this.pitch);
    const desired = new THREE.Vector3(
      this.focus.x + Math.sin(this.yaw) * cp * this.distance,
      this.focus.y + Math.sin(this.pitch) * this.distance,
      this.focus.z + Math.cos(this.yaw) * cp * this.distance,
    );
    if (!this.initialised) {
      this.smoothPos.copy(desired);
      this.initialised = true;
    }
    // Frame-rate independent smoothing: the camera trails slightly behind the player.
    this.smoothPos.lerp(desired, 1 - Math.exp(-9 * dt));
    this.camera.position.copy(this.clipToObstacles(dt, obstacles));
    this.camera.lookAt(this.focus);
  }

  /** Snap (no smoothing) on the next update, e.g. after a respawn. */
  snap(): void {
    this.initialised = false;
    this.clipDist = Infinity;
  }

  /** Shorten the focus -> camera arm so it stops in front of any platform it would pass through. */
  private clipToObstacles(dt: number, obstacles: readonly Box[]): THREE.Vector3 {
    const arm = this.smoothPos.clone().sub(this.focus);
    const len = arm.length();
    if (len < 1e-4 || obstacles.length === 0) {
      this.clipDist = Infinity;
      return this.smoothPos;
    }
    const dir = arm.divideScalar(len);
    const free = clipRay(this.focus, dir, len, obstacles);
    if (free < this.clipDist) this.clipDist = free;
    else this.clipDist = Math.min(free, this.clipDist + (free - this.clipDist) * (1 - Math.exp(-6 * dt)));
    return this.focus.clone().addScaledVector(dir, Math.min(len, this.clipDist));
  }

  private onDown = (): void => { this.dragging = true; };
  private onUp = (): void => { this.dragging = false; };
  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.yaw -= e.movementX * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * 0.004, 0.12, 1.2);
  };
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * 0.01, 5, 14);
  };

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointermove', this.onMove);
    this.dom.removeEventListener('wheel', this.onWheel);
  }
}
