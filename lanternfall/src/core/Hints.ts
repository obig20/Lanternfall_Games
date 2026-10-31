import { KeyValueStore, readJson } from './storage';

/** What the hint system needs to know about the player right now. */
export interface HintContext {
  /** Id of the platform or mover the player is standing on, or null in mid-air. */
  platformId: string | null;
  /** How many lantern pulses the player has fired this run. */
  pulsesFired: number;
  /** Falls since the last checkpoint was reached. */
  fallsSinceCheckpoint: number;
  /** Seconds the player has stood on the current platform. */
  secondsOnPlatform: number;
}

export interface HintDef {
  id: string;
  text: string;
  /** True when the hint would help right now. A hint is only ever shown once. */
  when: (c: HintContext) => boolean;
}

/** Short tips that teach the rules the first time they matter. Order = priority when several match. */
export const HINTS: readonly HintDef[] = [
  {
    id: 'stuck',
    text: 'Stuck? Press Q before a leap: the pulse reveals stones your lantern cannot reach.',
    when: (c) => c.fallsSinceCheckpoint >= 3,
  },
  {
    id: 'camera',
    text: 'Drag the mouse (or use the arrow keys) to turn the camera.',
    when: (c) => c.platformId === 'S' && c.secondsOnPlatform >= 12,
  },
  {
    id: 'pulse',
    text: 'Gap too wide to see across? Press Q to pulse and reveal the stones beyond.',
    when: (c) => (c.platformId === 'H2' || c.platformId === 'C1') && c.secondsOnPlatform >= 1.5 && c.pulsesFired === 0,
  },
  {
    id: 'beacon',
    text: 'A dormant crystal waits on the side ledge. Pulse close to it to wake it.',
    when: (c) => c.platformId === 'R2a' && c.secondsOnPlatform >= 1.5,
  },
  {
    id: 'drift',
    text: 'These stones drift back and forth. Wait for one to reach you, then jump. The dark one needs your light.',
    when: (c) => c.platformId === 'G2' && c.secondsOnPlatform >= 1.5,
  },
  {
    id: 'lift',
    text: 'The lift only reaches the gate at the top of its ride. Time your jump.',
    when: (c) => c.platformId === 'R3a' && c.secondsOnPlatform >= 1.5,
  },
];

export interface HintOptions {
  /** Minimum seconds between two hints, so tips never stack up. */
  cooldown?: number;
  key?: string;
}

/**
 * Decides when to show a tip. Each tip is shown once ever (remembered between sessions),
 * and never sooner than `cooldown` seconds after the previous one.
 */
export class HintEngine {
  private readonly seen: Set<string>;
  private readonly cooldown: number;
  private readonly key: string;
  private sinceLast: number;

  constructor(
    private readonly store: KeyValueStore,
    private readonly hints: readonly HintDef[] = HINTS,
    options: HintOptions = {},
  ) {
    this.cooldown = options.cooldown ?? 8;
    this.key = options.key ?? 'lanternfall.hints';
    this.seen = new Set(HintEngine.sanitize(readJson(store, this.key)));
    this.sinceLast = this.cooldown; // the first hint may show immediately
  }

  /** Keep only string ids from whatever was stored. */
  static sanitize(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((v): v is string => typeof v === 'string');
  }

  hasSeen(id: string): boolean {
    return this.seen.has(id);
  }

  /** Advance the clock by `dt` seconds. Returns a hint to show now, or null. */
  update(dt: number, ctx: HintContext): HintDef | null {
    this.sinceLast += dt;
    if (this.sinceLast < this.cooldown) return null;
    for (const h of this.hints) {
      if (this.seen.has(h.id) || !h.when(ctx)) continue;
      this.seen.add(h.id);
      this.sinceLast = 0;
      this.store.setItem(this.key, JSON.stringify([...this.seen]));
      return h;
    }
    return null;
  }
}
