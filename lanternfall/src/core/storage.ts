/** The tiny part of localStorage we use, so tests can swap in an in-memory version. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** In-memory store: used by tests, and as the fallback when localStorage is blocked. */
export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

/**
 * localStorage can throw (private browsing, blocked cookies, storage full).
 * Wrap it so the game keeps working and simply forgets between sessions.
 */
export function browserStore(): KeyValueStore {
  try {
    const ls = window.localStorage;
    ls.setItem('lanternfall.probe', '1');
    ls.removeItem('lanternfall.probe');
    return {
      getItem: (k) => {
        try { return ls.getItem(k); } catch { return null; }
      },
      setItem: (k, v) => {
        try { ls.setItem(k, v); } catch { /* storage full: ignore */ }
      },
    };
  } catch {
    return new MemoryStore();
  }
}

/** Parse JSON without throwing; returns null for missing or corrupt data. */
export function readJson(store: KeyValueStore, key: string): unknown {
  const raw = store.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
