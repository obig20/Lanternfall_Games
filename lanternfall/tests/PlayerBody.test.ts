import { describe, expect, it } from 'vitest';
import { Box } from '../src/physics/aabb';
import { PHYSICS, PLAYER_HALF, PlayerBody } from '../src/physics/PlayerBody';

const DT = 1 / 120;
const floor: Box = { min: { x: -5, y: -1, z: -5 }, max: { x: 5, y: 0, z: 5 } };
const none = { moveX: 0, moveZ: 0, jumpPressed: false };

function run(body: PlayerBody, seconds: number, solids: Box[], input = none): void {
  for (let i = 0; i < seconds / DT; i++) body.step(DT, input, solids);
}

describe('PlayerBody', () => {
  it('falls and lands on a platform', () => {
    const b = new PlayerBody({ x: 0, y: 3, z: 0 });
    run(b, 2, [floor]);
    expect(b.grounded).toBe(true);
    expect(b.pos.y).toBeCloseTo(PLAYER_HALF.y, 3);
  });

  it('stays put and grounded when idle (no sinking or jitter)', () => {
    const b = new PlayerBody({ x: 0, y: PLAYER_HALF.y, z: 0 });
    run(b, 3, [floor]);
    expect(b.grounded).toBe(true);
    expect(b.pos.y).toBeCloseTo(PLAYER_HALF.y, 3);
  });

  it('jumps to roughly the expected height', () => {
    const b = new PlayerBody({ x: 0, y: PLAYER_HALF.y, z: 0 });
    run(b, 0.5, [floor]);
    b.step(DT, { ...none, jumpPressed: true }, [floor]);
    let apex = b.pos.y;
    for (let i = 0; i < 2 / DT; i++) {
      b.step(DT, none, [floor]);
      apex = Math.max(apex, b.pos.y);
    }
    const expected = PLAYER_HALF.y + (PHYSICS.jumpSpeed ** 2) / (2 * PHYSICS.gravity);
    expect(Math.abs(apex - expected) < 0.1).toBe(true);
  });

  it('cannot jump in mid-air', () => {
    const b = new PlayerBody({ x: 0, y: 6, z: 0 });
    run(b, 0.3, [floor]);
    const vy = b.vel.y;
    const ev = b.step(DT, { ...none, jumpPressed: true }, [floor]);
    expect(ev.jumped).toBe(false);
    expect(b.vel.y < vy + 0.01).toBe(true);
  });

  it('is stopped by a wall', () => {
    const wall: Box = { min: { x: 2, y: 0, z: -5 }, max: { x: 3, y: 5, z: 5 } };
    const b = new PlayerBody({ x: 0, y: PLAYER_HALF.y, z: 0 });
    run(b, 2, [floor, wall], { moveX: 1, moveZ: 0, jumpPressed: false });
    expect(b.pos.x).toBeCloseTo(2 - PLAYER_HALF.x, 2);
  });

  it('falls off an edge and keeps falling', () => {
    const b = new PlayerBody({ x: 4, y: PLAYER_HALF.y, z: 0 });
    run(b, 2, [floor], { moveX: 1, moveZ: 0, jumpPressed: false });
    expect(b.grounded).toBe(false);
    expect(b.pos.y < -5).toBe(true);
  });

  it('allows a jump just after leaving an edge (coyote time) but not long after', () => {
    const edge: Box = { min: { x: -5, y: -1, z: -5 }, max: { x: 0, y: 0, z: 5 } };
    const early = new PlayerBody({ x: 0.3, y: PLAYER_HALF.y, z: 0 });
    run(early, 0.05, [edge]);
    // Walk off: centre must pass the edge by 0.35 before support is lost.
    while (early.grounded || early.pos.x < 0.36) early.step(DT, { moveX: 1, moveZ: 0, jumpPressed: false }, [edge]);
    expect(early.step(DT, { ...none, jumpPressed: true }, [edge]).jumped).toBe(true);

    const late = new PlayerBody({ x: 0.3, y: PLAYER_HALF.y, z: 0 });
    while (late.grounded || late.pos.x < 0.36) late.step(DT, { moveX: 1, moveZ: 0, jumpPressed: false }, [edge]);
    run(late, 0.3, [edge]);
    expect(late.step(DT, { ...none, jumpPressed: true }, [edge]).jumped).toBe(false);
  });

  it('buffers a jump pressed just before landing', () => {
    const b = new PlayerBody({ x: 0, y: PLAYER_HALF.y + 0.15, z: 0 });
    b.step(DT, { ...none, jumpPressed: true }, [floor]);
    let jumped = false;
    for (let i = 0; i < 20; i++) jumped = b.step(DT, none, [floor]).jumped || jumped;
    expect(jumped).toBe(true);
  });

  it('reports a landing with its speed', () => {
    const b = new PlayerBody({ x: 0, y: 4, z: 0 });
    let landed = false;
    let speed = 0;
    for (let i = 0; i < 3 / DT; i++) {
      const ev = b.step(DT, none, [floor]);
      if (ev.landed) { landed = true; speed = ev.landSpeed; }
    }
    expect(landed).toBe(true);
    expect(speed > 4).toBe(true);
  });
});
