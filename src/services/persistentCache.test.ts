import { describe, expect, it } from 'vitest';
import { clearPersistentCache, readPersistent, writePersistent } from './persistentCache';

describe('persistentCache', () => {
  it('returns values younger than the maximum age', () => {
    writePersistent('a', { value: 1 }, 1000);
    expect(readPersistent('a', 500, 1400)).toEqual({ value: 1 });
    expect(readPersistent('a', 500, 1600)).toBeUndefined();
  });

  it('keeps at most 40 entries and evicts the oldest', () => {
    for (let index = 0; index < 45; index += 1) writePersistent(`k${index}`, index, index);
    expect(readPersistent('k0', Infinity)).toBeUndefined();
    expect(readPersistent('k44', Infinity)).toBe(44);
  });

  it('can be cleared', () => {
    writePersistent('b', 'x');
    clearPersistentCache();
    expect(readPersistent('b', Infinity)).toBeUndefined();
  });

  it('ignores corrupted entries', () => {
    window.localStorage.setItem('aotd:cache:v1:bad', '{oops');
    expect(readPersistent('bad', Infinity)).toBeUndefined();
  });
});
