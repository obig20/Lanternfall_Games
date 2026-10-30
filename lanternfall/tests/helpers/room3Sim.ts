import { PLAYER_HALF, PlayerBody } from '../../src/physics/PlayerBody';
import { Lantern, RevealTracker } from '../../src/world/LightReveal';
import { MOVERS, MoverDef, PLATFORMS, platformBox } from '../../src/world/LevelData';
import { applyMovers, cycleLength, moverBox, moverTop } from '../../src/world/MovingPlatform';

/** Same fixed step the game uses. */
export const STEP = 1 / 60;

const staticBoxes = PLATFORMS.filter((p) => !p.hidden).map(platformBox);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

interface Spot {
  x: number;
  topY: number;
  z: number;
  w: number;
  d: number;
  mover: MoverDef | null;
}

export function spotOf(id: string, t: number, movers: readonly MoverDef[] = MOVERS): Spot {
  const m = movers.find((q) => q.id === id);
  if (m) return { ...moverTop(m, t), w: m.w, d: m.d, mover: m };
  const p = PLATFORMS.find((q) => q.id === id);
  if (!p) throw new Error(`Unknown platform ${id}`);
  return { x: p.cx, topY: p.topY, z: p.cz, w: p.w, d: p.d, mover: null };
}

/**
 * A bot that stands on `fromId` at time t0, runs toward -Z, jumps at the edge and steers at `toId`.
 * It pulses the lantern first when the target is a hidden (dark) mover.
 * Returns true if it lands on the target.
 */
export function runHop(fromId: string, toId: string, t0: number, movers: readonly MoverDef[] = MOVERS): boolean {
  const from = spotOf(fromId, t0, movers);
  const target0 = spotOf(toId, t0, movers);
  const run = from.d >= 4 ? 2 : 1;
  const x0 = from.mover ? from.x : clamp(target0.x, from.x - (from.w / 2 - 0.5), from.x + (from.w / 2 - 0.5));
  const body = new PlayerBody({ x: x0, y: from.topY + PLAYER_HALF.y + 0.01, z: from.z - from.d / 2 + run });

  const reveal = new RevealTracker();
  const lantern = new Lantern();
  const hiddenNow = (t: number) => movers.filter((m) => m.hidden).map((m) => ({ id: m.id, box: moverBox(m, t) }));
  const isDark = (id: string) => movers.some((m) => m.id === id && m.hidden);
  let t = t0;

  const tick = (jump: boolean, mx: number, mz: number): void => {
    const prev = t;
    t += STEP;
    lantern.update(STEP);
    reveal.update(STEP, hiddenNow(t), { x: body.pos.x, y: body.feetY + 1.3, z: body.pos.z }, lantern.radius);
    const boxes = applyMovers(body, movers, prev, t, (id) => !isDark(id) || reveal.isSolid(id));
    body.step(STEP, { moveX: mx, moveZ: mz, jumpPressed: jump }, [...staticBoxes, ...boxes]);
  };

  for (let i = 0; i < 10; i++) tick(false, 0, 0); // settle (a dark source lights up under our feet)
  if (isDark(toId)) lantern.tryPulse();

  let jumped = false;
  for (let i = 0; i < 4 / STEP; i++) {
    const target = spotOf(toId, t, movers);
    const here = spotOf(fromId, t, movers);
    const atEdge = body.pos.z - (here.z - here.d / 2) <= 0.1;
    const wantJump = !jumped && body.grounded && atEdge;
    if (wantJump) jumped = true;
    tick(wantJump, clamp((target.x - body.pos.x) * 2, -1, 1), -1);
    if (jumped && body.grounded) {
      const end = spotOf(toId, t, movers);
      return Math.abs(body.pos.x - end.x) <= end.w / 2 && Math.abs(body.pos.z - end.z) <= end.d / 2 && Math.abs(body.feetY - end.topY) < 0.06;
    }
    if (body.pos.y < Math.min(from.topY, target.topY) - 5) return false;
  }
  return false;
}

/** Fraction of start moments (spread over one full cycle) from which the hop succeeds. */
export function windowFraction(fromId: string, toId: string, movers: readonly MoverDef[] = MOVERS, stepSeconds = 0.2): number {
  const involved = movers.filter((m) => m.id === fromId || m.id === toId);
  const cycle = Math.max(...involved.map(cycleLength), 1);
  let ok = 0;
  let n = 0;
  for (let t0 = 0; t0 < cycle; t0 += stepSeconds) {
    n++;
    if (runHop(fromId, toId, t0, movers)) ok++;
  }
  return ok / n;
}

