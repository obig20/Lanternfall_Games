import { KeyValueStore, readJson } from './storage';

/** Stored shape. `furthest` is an index into CHECKPOINTS, or -1 when no checkpoint has been reached. */
interface SavedProgress {
  furthest: number;
}

/**
 * Remembers how far through the tower the player has got, so the title screen can offer "Continue".
 * It only ever moves forward during a run; finishing or restarting clears it.
 */
export class ProgressStore {
  private furthest: number;

  constructor(
    private readonly store: KeyValueStore,
    private readonly checkpointCount: number,
    private readonly key = 'lanternfall.progress',
  ) {
    this.furthest = ProgressStore.sanitize(readJson(store, key), checkpointCount);
  }

  /** Turn anything stored (old saves, hand-edited JSON, a tower that changed size) into a valid index. */
  static sanitize(raw: unknown, checkpointCount: number): number {
    if (typeof raw !== 'object' || raw === null) return -1;
    const value = (raw as Partial<SavedProgress>).furthest;
    if (typeof value !== 'number' || !Number.isInteger(value)) return -1;
    return value >= 0 && value < checkpointCount ? value : -1;
  }

  /** Index of the furthest checkpoint reached, or -1. */
  get furthestCheckpoint(): number {
    return this.furthest;
  }

  get canContinue(): boolean {
    return this.furthest >= 0;
  }

  /** Call when a checkpoint is reached. Returns true if this is new progress. */
  reach(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.checkpointCount) return false;
    if (index <= this.furthest) return false;
    this.furthest = index;
    this.save();
    return true;
  }

  /** Forget everything (run finished, or the player chose to start over). */
  clear(): void {
    if (this.furthest === -1) return;
    this.furthest = -1;
    this.save();
  }

  private save(): void {
    const data: SavedProgress = { furthest: this.furthest };
    this.store.setItem(this.key, JSON.stringify(data));
  }
}
