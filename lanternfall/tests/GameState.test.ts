import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';

describe('GameState', () => {
  it('starts in menu', () => {
    expect(new GameState().phase).toBe('menu');
  });

  it('allows menu -> playing -> paused -> playing', () => {
    const s = new GameState();
    expect(s.transition('playing')).toBe(true);
    expect(s.transition('paused')).toBe(true);
    expect(s.transition('playing')).toBe(true);
    expect(s.phase).toBe('playing');
  });

  it('rejects illegal transitions and keeps the phase', () => {
    const s = new GameState();
    expect(s.transition('won')).toBe(false);
    expect(s.phase).toBe('menu');
  });
});
