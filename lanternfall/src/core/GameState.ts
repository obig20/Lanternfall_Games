export type GamePhase = 'menu' | 'playing' | 'paused' | 'won' | 'lost';

const ALLOWED: Record<GamePhase, GamePhase[]> = {
  menu: ['playing'],
  playing: ['paused', 'won', 'lost'],
  paused: ['playing', 'menu'],
  won: ['playing', 'menu'],
  lost: ['playing', 'menu'],
};

/** Small state machine: only legal phase changes are accepted. */
export class GameState {
  private current: GamePhase = 'menu';

  get phase(): GamePhase {
    return this.current;
  }

  can(next: GamePhase): boolean {
    return ALLOWED[this.current].includes(next);
  }

  /** Returns true if the change happened, false if it was illegal. */
  transition(next: GamePhase): boolean {
    if (!this.can(next)) return false;
    this.current = next;
    return true;
  }
}
