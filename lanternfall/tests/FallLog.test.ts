import { describe, expect, it } from 'vitest';
import { FallLog } from '../src/core/FallLog';

describe('FallLog', () => {
  it('starts empty', () => {
    const log = new FallLog();
    expect(log.worst()).toEqual(null);
    expect(log.total).toBe(0);
  });

  it('finds the platform with the most falls', () => {
    const log = new FallLog();
    ['H2', 'H5', 'H5', 'B', 'H5', 'H2'].forEach((id) => log.record(id));
    expect(log.worst()).toEqual({ id: 'H5', count: 3 });
    expect(log.total).toBe(6);
  });

  it('breaks ties by the earliest platform and ignores unknown spots', () => {
    const log = new FallLog();
    log.record('H3');
    log.record('H1');
    log.record(null);
    expect(log.worst()).toEqual({ id: 'H3', count: 1 });
    expect(log.total).toBe(2);
  });

  it('reset clears everything', () => {
    const log = new FallLog();
    log.record('A');
    log.reset();
    expect(log.worst()).toEqual(null);
  });
});
