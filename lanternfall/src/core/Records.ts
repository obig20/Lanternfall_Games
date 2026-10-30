import { KeyValueStore, readJson } from './storage';

export interface RunResult {
  /** Seconds. */
  time: number;
  falls: number;
}

export interface RunRecord {
  bestTime: number | null;
  fewestFalls: number | null;
  /** Number of completed runs. */
  runs: number;
}

export interface SubmitOutcome {
  newBestTime: boolean;
  newBestFalls: boolean;
  /** True only when there was an earlier record to beat (the first run is not a "new best"). */
  beatPrevious: boolean;
  record: RunRecord;
}

const EMPTY: RunRecord = { bestTime: null, fewestFalls: null, runs: 0 };

const validNumber = (v: unknown, integer: boolean): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && (!integer || Number.isInteger(v));

function sanitizeRecord(raw: unknown): RunRecord {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY };
  const r = raw as Record<string, unknown>;
  return {
    bestTime: validNumber(r.bestTime, false) ? r.bestTime : null,
    fewestFalls: validNumber(r.fewestFalls, true) ? r.fewestFalls : null,
    runs: validNumber(r.runs, true) ? r.runs : 0,
  };
}

/** "1:05.3" style time. */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const tenths = Math.floor(safe * 10);
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${s.toString().padStart(2, '0')}.${tenths % 10}`;
}

/** Best time and fewest falls per run id, saved between sessions. */
export class Records {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key = 'lanternfall.records',
  ) {}

  private all(): Record<string, RunRecord> {
    const raw = readJson(this.store, this.key);
    if (typeof raw !== 'object' || raw === null) return {};
    const out: Record<string, RunRecord> = {};
    for (const [id, value] of Object.entries(raw)) out[id] = sanitizeRecord(value);
    return out;
  }

  get(runId: string): RunRecord {
    return this.all()[runId] ?? { ...EMPTY };
  }

  /** Record a finished run and say whether it beat the old best. */
  submit(runId: string, run: RunResult): SubmitOutcome {
    const all = this.all();
    const before = all[runId] ?? { ...EMPTY };
    const had = before.runs > 0;
    const newBestTime = before.bestTime === null || run.time < before.bestTime;
    const newBestFalls = before.fewestFalls === null || run.falls < before.fewestFalls;
    const record: RunRecord = {
      bestTime: newBestTime ? run.time : before.bestTime,
      fewestFalls: newBestFalls ? run.falls : before.fewestFalls,
      runs: before.runs + 1,
    };
    all[runId] = record;
    this.store.setItem(this.key, JSON.stringify(all));
    return {
      newBestTime: had && newBestTime,
      newBestFalls: had && newBestFalls,
      beatPrevious: had && (newBestTime || newBestFalls),
      record,
    };
  }
}
