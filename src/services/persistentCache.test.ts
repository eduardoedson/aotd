import { describe, expect, it } from 'vitest';
import {
  clearPersistentCache,
  MAX_STORED_AGE_MS,
  peekPersistent,
  readPersistent,
  writePersistent,
} from './persistentCache';

const INDEX_KEY = 'aotd:cache:v1:index';
const readIndex = () => JSON.parse(window.localStorage.getItem(INDEX_KEY) ?? '{}');

describe('persistentCache', () => {
  it('returns values younger than the maximum age', () => {
    writePersistent('a', { value: 1 }, 1000);
    expect(readPersistent('a', 500, 1400)).toEqual({ value: 1 });
    expect(readPersistent('a', 500, 1600)).toBeUndefined();
  });

  it('keeps at most 40 entries and evicts the oldest', () => {
    for (let index = 0; index < 45; index += 1) writePersistent(`k${index}`, index, index);
    expect(readPersistent('k0', Infinity, 50)).toBeUndefined();
    expect(readPersistent('k44', Infinity, 50)).toBe(44);
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

  it('keeps entries that are only too old for one caller', () => {
    writePersistent('fallback', 'x', 0);
    expect(readPersistent('fallback', 1000, 5000)).toBeUndefined();
    expect(readPersistent('fallback', 10000, 5000)).toBe('x');
    expect(readIndex()).toHaveProperty('fallback');
  });

  it('removes entries past the maximum stored age and updates the index', () => {
    writePersistent('dead', 'x', 0);
    expect(readPersistent('dead', Infinity, MAX_STORED_AGE_MS + 1)).toBeUndefined();
    expect(window.localStorage.getItem('aotd:cache:v1:dead')).toBeNull();
    expect(readIndex()).not.toHaveProperty('dead');
  });

  it('removes corrupted entries from the index', () => {
    writePersistent('broken', 'x', 0);
    window.localStorage.setItem('aotd:cache:v1:broken', '{oops');
    readPersistent('broken', Infinity, 1);
    expect(readIndex()).not.toHaveProperty('broken');
  });

  it('peeks without changing storage', () => {
    writePersistent('peek', 'x', 0);
    expect(peekPersistent('peek', Infinity, MAX_STORED_AGE_MS + 1)).toBeUndefined();
    expect(window.localStorage.getItem('aotd:cache:v1:peek')).not.toBeNull();
    expect(peekPersistent('peek', Infinity, 10)).toBe('x');
  });

  it('drops dead entries before evicting live ones', () => {
    const start = MAX_STORED_AGE_MS * 2;
    for (let index = 0; index < 20; index += 1) writePersistent(`old${index}`, index, index);
    for (let index = 0; index < 25; index += 1) {
      writePersistent(`new${index}`, index, start + index);
    }
    expect(readPersistent('new0', Infinity, start + 100)).toBe(0);
    expect(Object.keys(readIndex())).toHaveLength(25);
  });
});
