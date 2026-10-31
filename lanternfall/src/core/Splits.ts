import { KeyValueStore, readJson } from './storage';

export interface SplitResult {
  /** Seconds this checkpoint took to reach. */
  time: number;
  /** This time minus the previous best (negative = faster). Null on the first ever split. */
  delta: number | null;
  isBest: boolean;
}

/** "+1.3s" or "-0.4s" (one decimal). Exactly zero shows as "+0.0s". */
export function formatDelta(delta: number): string {
  const rounded = Math.round(Math.abs(delta) * 10) / 10;
  const sign = delta < 0 && rounded > 0 ? '-' : '+';
  return `${sign}${rounded.toFixed(1)}s`;
}

/**
 * Best time to reach each checkpoint, so the player sees whether they are ahead of
 * or behind their own pace. Times are measured from the start of a full run.
 */
export class SplitBook {
  private best: (number | null)[];

  constructor(
    private readonly store: KeyValueStore,
    private readonly count: number,
    private readonly key = 'lanternfall.splits',
  ) {
    this.best = SplitBook.sanitize(readJson(store, key), count);
  }

  /** Always returns exactly `count` entries; anything invalid becomes null. */
  static sanitize(raw: unknown, count: number): (number | null)[] {
    const out: (number | null)[] = Array.from({ length: count }, () => null);
    if (!Array.isArray(raw)) return out;
    for (let i = 0; i < count; i++) {
      const v: unknown = raw[i];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[i] = v;
    }
    return out;
  }

  bestFor(index: number): number | null {
    return this.best[index] ?? null;
  }

  /** Record a split. Out-of-range indices and non-positive times are ignored (returns null). */
  record(index: number, time: number): SplitResult | null {
    if (!Number.isInteger(index) || index < 0 || index >= this.count) return null;
    if (!Number.isFinite(time) || time <= 0) return null;
    const previous = this.best[index];
    const isBest = previous === null || time < previous;
    if (isBest) {
      this.best[index] = time;
      this.store.setItem(this.key, JSON.stringify(this.best));
    }
    return { time, delta: previous === null ? null : time - previous, isBest };
  }
}
