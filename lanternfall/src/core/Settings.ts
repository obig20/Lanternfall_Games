import { KeyValueStore, readJson } from './storage';

export interface Settings {
  /** Master volume, 0..1. */
  volume: number;
  /** Camera turn speed multiplier. */
  sensitivity: number;
  invertY: boolean;
  /** Show one-time tips (see Hints.ts). */
  showHints: boolean;
  /** Show the translucent ghost of your best run. */
  showGhost: boolean;
  /** Skip the dark flash when you fall and respawn. */
  reduceFlash: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  volume: 0.5,
  sensitivity: 1,
  invertY: false,
  showHints: true,
  showGhost: true,
  reduceFlash: false,
};
export const SETTING_LIMITS = {
  volume: { min: 0, max: 1 },
  sensitivity: { min: 0.3, max: 2.5 },
} as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

function num(raw: unknown, fallback: number, lo: number, hi: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? clamp(raw, lo, hi) : fallback;
}

/** Turn anything (old saves, hand-edited JSON, garbage) into a valid Settings object. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    volume: num(r.volume, DEFAULT_SETTINGS.volume, SETTING_LIMITS.volume.min, SETTING_LIMITS.volume.max),
    sensitivity: num(r.sensitivity, DEFAULT_SETTINGS.sensitivity, SETTING_LIMITS.sensitivity.min, SETTING_LIMITS.sensitivity.max),
    invertY: bool(r.invertY, DEFAULT_SETTINGS.invertY),
    showHints: bool(r.showHints, DEFAULT_SETTINGS.showHints),
    showGhost: bool(r.showGhost, DEFAULT_SETTINGS.showGhost),
    reduceFlash: bool(r.reduceFlash, DEFAULT_SETTINGS.reduceFlash),
  };
}

type Listener = (s: Settings) => void;

/** Loads, validates, saves and announces changes to the player's settings. */
export class SettingsStore {
  private current: Settings;
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly store: KeyValueStore,
    private readonly key = 'lanternfall.settings',
  ) {
    this.current = sanitizeSettings(readJson(store, key));
  }

  get(): Readonly<Settings> {
    return this.current;
  }

  set(patch: Partial<Settings>): Settings {
    this.current = sanitizeSettings({ ...this.current, ...patch });
    this.store.setItem(this.key, JSON.stringify(this.current));
    for (const fn of this.listeners) fn(this.current);
    return this.current;
  }

  reset(): Settings {
    return this.set({ ...DEFAULT_SETTINGS });
  }

  /** Returns an unsubscribe function. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
