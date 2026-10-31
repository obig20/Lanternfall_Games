import { KeyValueStore, readJson } from './storage';

/** What happened in a finished run. */
export interface RunSummary {
  /** Seconds from start to gate. */
  time: number;
  falls: number;
  /** Lantern pulses fired. */
  pulses: number;
  /** Completed runs including this one (from Records). */
  totalRuns: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  earned: (run: RunSummary) => boolean;
}

/**
 * Time targets are design guesses, not measured data. Nobody has timed real players yet,
 * so they are named constants that are easy to retune after playtesting.
 */
export const QUICK_TIME = 120;
export const FAST_TIME = 75;
export const FEW_PULSES = 3;
export const PERSISTENT_FALLS = 10;
export const VETERAN_RUNS = 5;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-light',
    title: 'First light',
    description: 'Reach the golden gate.',
    earned: () => true,
  },
  {
    id: 'flawless',
    title: 'Flawless',
    description: 'Finish without falling once.',
    earned: (r) => r.falls === 0,
  },
  {
    id: 'quick',
    title: 'Quick feet',
    description: `Finish in under ${QUICK_TIME} seconds.`,
    earned: (r) => r.time < QUICK_TIME,
  },
  {
    id: 'fast',
    title: 'Lightning',
    description: `Finish in under ${FAST_TIME} seconds.`,
    earned: (r) => r.time < FAST_TIME,
  },
  {
    id: 'frugal',
    title: 'Frugal light',
    description: `Finish using at most ${FEW_PULSES} pulses.`,
    earned: (r) => r.pulses <= FEW_PULSES,
  },
  {
    id: 'persistent',
    title: 'Never give up',
    description: `Finish after ${PERSISTENT_FALLS} or more falls.`,
    earned: (r) => r.falls >= PERSISTENT_FALLS,
  },
  {
    id: 'veteran',
    title: 'Tower regular',
    description: `Finish the tower ${VETERAN_RUNS} times.`,
    earned: (r) => r.totalRuns >= VETERAN_RUNS,
  },
];

/** Keeps only string ids from whatever was saved. */
export function sanitizeEarned(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

/** Unlocks achievements at the end of a run and remembers them between sessions. */
export class AchievementBook {
  private readonly earned: Set<string>;

  constructor(
    private readonly store: KeyValueStore,
    private readonly defs: readonly AchievementDef[] = ACHIEVEMENTS,
    private readonly key = 'lanternfall.achievements',
  ) {
    const known = new Set(defs.map((d) => d.id));
    this.earned = new Set(sanitizeEarned(readJson(store, key)).filter((id) => known.has(id)));
  }

  has(id: string): boolean {
    return this.earned.has(id);
  }

  get count(): number {
    return this.earned.size;
  }

  get total(): number {
    return this.defs.length;
  }

  /** Check a finished run. Returns only the achievements unlocked for the first time. */
  evaluate(run: RunSummary): AchievementDef[] {
    const fresh = this.defs.filter((d) => !this.earned.has(d.id) && d.earned(run));
    if (fresh.length === 0) return [];
    for (const d of fresh) this.earned.add(d.id);
    this.store.setItem(this.key, JSON.stringify([...this.earned]));
    return fresh;
  }
}
