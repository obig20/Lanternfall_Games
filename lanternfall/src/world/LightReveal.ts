import { Box, Vec3, distanceToBox } from '../physics/aabb';

/**
 * THE RULE (the heart of the game):
 *   A hidden platform is LIT when the lantern is within `radius` of the
 *   platform's nearest point. A lit platform is visible and solid.
 *   When the light leaves, the platform stays solid for `linger` seconds
 *   (so it doesn't vanish under your feet), then disappears.
 */
export const LANTERN = {
  /** Always-on light carried by the player. */
  heldRadius: 3,
  /** Temporary bigger light from pressing Q: scouts the route ahead. */
  pulseRadius: 12,
  pulseDuration: 3,
  /** Time from one pulse start until the next is allowed. */
  pulseCooldown: 5,
  linger: 0.6,
} as const;

export function isLit(box: Box, lanternPos: Vec3, radius: number): boolean {
  return distanceToBox(box, lanternPos) <= radius;
}

export class Lantern {
  private pulseLeft = 0;
  private cooldownLeft = 0;

  /** Current light radius. */
  get radius(): number {
    return this.pulseLeft > 0 ? LANTERN.pulseRadius : LANTERN.heldRadius;
  }

  get pulsing(): boolean {
    return this.pulseLeft > 0;
  }

  /** 0 = just used, 1 = ready. */
  get charge(): number {
    return 1 - this.cooldownLeft / LANTERN.pulseCooldown;
  }

  get ready(): boolean {
    return this.cooldownLeft <= 0;
  }

  /** Returns true if the pulse started. */
  tryPulse(): boolean {
    if (!this.ready) return false;
    this.pulseLeft = LANTERN.pulseDuration;
    this.cooldownLeft = LANTERN.pulseCooldown;
    return true;
  }

  update(dt: number): void {
    this.pulseLeft = Math.max(0, this.pulseLeft - dt);
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
  }

  reset(): void {
    this.pulseLeft = 0;
    this.cooldownLeft = 0;
  }
}

export interface HiddenPlatform {
  id: string;
  box: Box;
  /** Locked platforms ignore the lantern completely; only a beacon (unlock) makes them solid. */
  locked?: boolean;
}

export interface RevealChange {
  revealed: string[];
  hidden: string[];
}

/** Tracks which hidden platforms are currently solid. */
export class RevealTracker {
  private timers = new Map<string, number>();
  /** Platforms made permanently solid by a beacon. Survives respawns; cleared by clearPins(). */
  private pinned = new Set<string>();

  update(dt: number, platforms: readonly HiddenPlatform[], lanternPos: Vec3, radius: number): RevealChange {
    const change: RevealChange = { revealed: [], hidden: [] };
    for (const p of platforms) {
      if (p.locked) continue; // only beacons can reveal these
      const before = this.timers.get(p.id) ?? 0;
      let after: number;
      if (isLit(p.box, lanternPos, radius)) after = LANTERN.linger;
      else after = Math.max(0, before - dt);
      this.timers.set(p.id, after);
      if (before <= 0 && after > 0) change.revealed.push(p.id);
      if (before > 0 && after <= 0) change.hidden.push(p.id);
    }
    return change;
  }

  isSolid(id: string): boolean {
    return this.pinned.has(id) || (this.timers.get(id) ?? 0) > 0;
  }

  /** Permanently reveal platforms (a beacon was woken). Returns the ones that were newly pinned. */
  unlock(ids: readonly string[]): string[] {
    const fresh = ids.filter((id) => !this.pinned.has(id));
    fresh.forEach((id) => this.pinned.add(id));
    return fresh;
  }

  clearPins(): void {
    this.pinned.clear();
  }

  /** 0..1 for rendering: full while lit, fades during the last half of the linger. */
  visibility(id: string): number {
    if (this.pinned.has(id)) return 1;
    const t = this.timers.get(id) ?? 0;
    return Math.min(1, t / (LANTERN.linger * 0.5));
  }

  /** Forget temporary light (e.g. after respawn). Beacon unlocks are kept. */
  reset(): void {
    this.timers.clear();
  }
}
