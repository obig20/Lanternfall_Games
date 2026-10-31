import { KeyValueStore, readJson } from './storage';

export interface LifetimeTotals {
  runsStarted: number;
  runsCompleted: number;
  falls: number;
  pulses: number;
  /** Seconds spent playing (not paused, not on a menu). */
  seconds: number;
}

const EMPTY: Readonly<LifetimeTotals> = { runsStarted: 0, runsCompleted: 0, falls: 0, pulses: 0, seconds: 0 };
const FIELDS = Object.keys(EMPTY) as (keyof LifetimeTotals)[];

/** Keep each field a finite number >= 0; anything else becomes 0. */
export function sanitizeTotals(raw: unknown): LifetimeTotals {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const out = { ...EMPTY };
  for (const f of FIELDS) {
    const v = r[f];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[f] = v;
  }
  return out;
}

/** "45s", "12m" or "1h 05m". Short on purpose: it sits on the pause screen. */
export function formatPlaytime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${(minutes % 60).toString().padStart(2, '0')}m`;
}

/**
 * Running totals across every session. Adding is cheap (memory only); call `save()` at calm moments
 * such as pausing or finishing a run, so the game does not write to storage every frame.
 */
export class LifetimeStats {
  private totals: LifetimeTotals;
  private dirty = false;

  constructor(
    private readonly store: KeyValueStore,
    private readonly key = 'lanternfall.lifetime',
  ) {
    this.totals = sanitizeTotals(readJson(store, key));
  }

  get(): Readonly<LifetimeTotals> {
    return this.totals;
  }

  /** Add to the totals. Negative, NaN and Infinity amounts are ignored. */
  add(patch: Partial<LifetimeTotals>): void {
    for (const f of FIELDS) {
      const v = patch[f];
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
      this.totals[f] += v;
      this.dirty = true;
    }
  }

  /** Write to storage if anything changed since the last save. Returns true if it wrote. */
  save(): boolean {
    if (!this.dirty) return false;
    this.store.setItem(this.key, JSON.stringify(this.totals));
    this.dirty = false;
    return true;
  }

  /** One line for the pause screen, or '' before anything has been played. */
  summary(): string {
    const t = this.totals;
    if (t.seconds < 1 && t.runsStarted === 0) return '';
    const runs = `${t.runsCompleted} of ${t.runsStarted} runs finished`;
    return `${formatPlaytime(t.seconds)} played  ·  ${t.falls} falls  ·  ${runs}`;
  }
}
