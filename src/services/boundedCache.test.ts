import { describe, expect, it } from 'vitest';
import { pruneMap } from './boundedCache';

describe('pruneMap', () => {
  it('drops expired entries first, then the oldest above the limit', () => {
    const map = new Map([
      ['a', { expired: false }],
      ['b', { expired: true }],
      ['c', { expired: false }],
      ['d', { expired: false }],
    ]);
    pruneMap(map, { maxEntries: 2, isExpired: (value) => value.expired });
    expect([...map.keys()]).toEqual(['c', 'd']);
  });
});
