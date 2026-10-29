import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';

type Ev = { ping: { n: number } };

describe('EventBus', () => {
  it('delivers payloads to subscribers', () => {
    const bus = new EventBus<Ev>();
    let got = 0;
    bus.on('ping', (p) => (got = p.n));
    bus.emit('ping', { n: 7 });
    expect(got).toBe(7);
  });

  it('stops delivering after unsubscribe', () => {
    const bus = new EventBus<Ev>();
    let calls = 0;
    const off = bus.on('ping', () => calls++);
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(calls).toBe(1);
  });
});
