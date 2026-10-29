import { Box, Vec3, overlaps } from './aabb';

/** Half the player's size on each axis. The player is a 0.7 x 1.8 x 0.7 box. */
export const PLAYER_HALF: Readonly<Vec3> = { x: 0.35, y: 0.9, z: 0.35 };

export const PHYSICS = {
  moveSpeed: 6,
  groundAccel: 50,
  airAccel: 25,
  gravity: 24,
  jumpSpeed: 9,
  maxFallSpeed: 32,
  /** Grace period: you can still jump this long after walking off an edge. */
  coyoteTime: 0.1,
  /** Grace period: a jump pressed this early before landing still counts. */
  jumpBuffer: 0.12,
} as const;

export interface BodyInput {
  /** Desired horizontal direction in world space (length <= 1). */
  moveX: number;
  moveZ: number;
  /** True only on the frame the jump key went down. */
  jumpPressed: boolean;
}

export interface StepEvents {
  jumped: boolean;
  landed: boolean;
  /** Downward speed at the moment of landing (positive number). */
  landSpeed: number;
}

type Axis = 'x' | 'y' | 'z';

const approach = (v: number, target: number, maxDelta: number): number =>
  v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target);

/**
 * Simple kinematic player: gravity, jumping, and box collision, one axis at a time.
 * No rendering code here, so it can be unit-tested without a browser.
 */
export class PlayerBody {
  readonly pos: Vec3;
  readonly vel: Vec3 = { x: 0, y: 0, z: 0 };
  grounded = false;
  private coyote = 0;
  private buffer = 0;

  constructor(start: Vec3) {
    this.pos = { ...start };
  }

  reset(at: Vec3): void {
    Object.assign(this.pos, at);
    this.vel.x = this.vel.y = this.vel.z = 0;
    this.grounded = false;
    this.coyote = 0;
    this.buffer = 0;
  }

  get box(): Box {
    const { pos: p } = this;
    return {
      min: { x: p.x - PLAYER_HALF.x, y: p.y - PLAYER_HALF.y, z: p.z - PLAYER_HALF.z },
      max: { x: p.x + PLAYER_HALF.x, y: p.y + PLAYER_HALF.y, z: p.z + PLAYER_HALF.z },
    };
  }

  /** Y of the player's feet. */
  get feetY(): number {
    return this.pos.y - PLAYER_HALF.y;
  }

  step(dt: number, input: BodyInput, solids: readonly Box[]): StepEvents {
    const wasGrounded = this.grounded;
    const events: StepEvents = { jumped: false, landed: false, landSpeed: 0 };

    // Horizontal: accelerate toward the wanted velocity.
    const len = Math.hypot(input.moveX, input.moveZ);
    const k = len > 1 ? 1 / len : 1;
    const accel = (this.grounded ? PHYSICS.groundAccel : PHYSICS.airAccel) * dt;
    this.vel.x = approach(this.vel.x, input.moveX * k * PHYSICS.moveSpeed, accel);
    this.vel.z = approach(this.vel.z, input.moveZ * k * PHYSICS.moveSpeed, accel);

    // Jump with coyote time + input buffering (makes jumping feel forgiving).
    this.buffer = input.jumpPressed ? PHYSICS.jumpBuffer : Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? PHYSICS.coyoteTime : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && this.coyote > 0) {
      this.vel.y = PHYSICS.jumpSpeed;
      this.buffer = 0;
      this.coyote = 0;
      this.grounded = false;
      events.jumped = true;
    }

    this.vel.y = Math.max(-PHYSICS.maxFallSpeed, this.vel.y - PHYSICS.gravity * dt);

    this.grounded = false;
    this.moveAxis('x', this.vel.x * dt, solids);
    this.moveAxis('z', this.vel.z * dt, solids);
    const impact = this.vel.y;
    this.moveAxis('y', this.vel.y * dt, solids);

    if (!wasGrounded && this.grounded && impact < -4) {
      events.landed = true;
      events.landSpeed = -impact;
    }
    return events;
  }

  /** Move along one axis, then push out of anything we now overlap. */
  private moveAxis(axis: Axis, delta: number, solids: readonly Box[]): void {
    if (delta === 0) return;
    this.pos[axis] += delta;
    for (const s of solids) {
      if (!overlaps(this.box, s)) continue;
      if (delta > 0) {
        this.pos[axis] = s.min[axis] - PLAYER_HALF[axis];
      } else {
        this.pos[axis] = s.max[axis] + PLAYER_HALF[axis];
        if (axis === 'y') this.grounded = true;
      }
      this.vel[axis] = 0;
    }
  }
}
