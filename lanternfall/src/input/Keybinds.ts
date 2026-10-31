import { KeyValueStore, readJson } from '../core/storage';

/** Everything the keyboard can do in game. Gamepad and touch have their own fixed layouts. */
export type Action =
  | 'forward' | 'back' | 'left' | 'right'
  | 'jump' | 'pulse' | 'restart' | 'pause' | 'mute'
  | 'turnLeft' | 'turnRight';

export const ACTIONS: readonly Action[] = [
  'forward', 'back', 'left', 'right', 'jump', 'pulse', 'restart', 'pause', 'mute', 'turnLeft', 'turnRight',
];

/** One key per action, as `KeyboardEvent.code` values (layout independent: "KeyW" is the W position). */
export type Bindings = Readonly<Record<Action, string>>;

export const DEFAULT_BINDINGS: Bindings = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  pulse: 'KeyQ',
  restart: 'KeyR',
  pause: 'KeyP',
  mute: 'KeyM',
  turnLeft: 'ArrowLeft',
  turnRight: 'ArrowRight',
};

export const ACTION_LABELS: Readonly<Record<Action, string>> = {
  forward: 'Move forward',
  back: 'Move back',
  left: 'Move left',
  right: 'Move right',
  jump: 'Jump',
  pulse: 'Lantern pulse',
  restart: 'Back to checkpoint',
  pause: 'Pause',
  mute: 'Mute',
  turnLeft: 'Turn camera left',
  turnRight: 'Turn camera right',
};

/** Escape always pauses and always cancels, so it can never be given to another action. */
export const RESERVED_CODES: ReadonlySet<string> = new Set(['Escape']);

const CODE_PATTERN = /^[A-Za-z0-9]{1,16}$/;

export function isBindableCode(code: unknown): code is string {
  return typeof code === 'string' && CODE_PATTERN.test(code) && !RESERVED_CODES.has(code);
}

/**
 * Turn anything stored (old saves, edited JSON) into a valid set of bindings. Bad entries fall back to
 * their default. If two actions would end up on the same key, the whole set is reset: a half-fixed
 * layout would be more confusing than starting over.
 */
export function sanitizeBindings(raw: unknown): Bindings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const out = {} as Record<Action, string>;
  const used = new Set<string>();
  for (const action of ACTIONS) {
    const saved = r[action];
    const code = isBindableCode(saved) ? saved : DEFAULT_BINDINGS[action];
    if (used.has(code)) return { ...DEFAULT_BINDINGS };
    used.add(code);
    out[action] = code;
  }
  return out;
}

export interface RebindResult {
  bindings: Bindings;
  /** If the new key was already in use, the action that took over the old key. */
  swapped: Action | null;
}

/** Give `action` the key `code`. A key already used elsewhere is swapped, so no action is ever left without one. */
export function rebind(bindings: Bindings, action: Action, code: string): RebindResult | null {
  if (!isBindableCode(code)) return null;
  if (bindings[action] === code) return { bindings, swapped: null };
  const other = ACTIONS.find((a) => a !== action && bindings[a] === code) ?? null;
  const next: Record<Action, string> = { ...bindings, [action]: code };
  if (other) next[other] = bindings[action];
  return { bindings: next, swapped: other };
}

/** Short text for a key button: "W", "Space", "←", "1". */
export function keyLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
  const arrows: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
  return arrows[code] ?? code.replace(/(Left|Right)$/, ' $1').trim();
}

type Listener = (b: Bindings) => void;

/** Loads, validates, saves and announces changes to the keyboard layout. */
export class BindingStore {
  private current: Bindings;
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly store: KeyValueStore,
    private readonly key = 'lanternfall.keys',
  ) {
    this.current = sanitizeBindings(readJson(store, key));
  }

  get(): Bindings {
    return this.current;
  }

  /** Returns what happened, or null if the key is not allowed. */
  rebind(action: Action, code: string): RebindResult | null {
    const result = rebind(this.current, action, code);
    if (!result) return null;
    if (result.bindings !== this.current) {
      this.current = result.bindings;
      this.save();
    }
    return result;
  }

  reset(): void {
    this.current = { ...DEFAULT_BINDINGS };
    this.save();
  }

  /** Returns an unsubscribe function. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private save(): void {
    this.store.setItem(this.key, JSON.stringify(this.current));
    for (const fn of this.listeners) fn(this.current);
  }
}
