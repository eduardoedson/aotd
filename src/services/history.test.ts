import { afterEach, describe, expect, it } from 'vitest';
import { addHistory, historyStore } from './history';

afterEach(() => {
  window.localStorage.clear();
  historyStore.reset();
});

describe('viewing history', () => {
  it('keeps the newest view first and de-duplicates titles', () => {
    addHistory({ id: 1, title: 'First', date: '2026-01-01' });
    addHistory({ id: 2, title: 'Second', date: '2026-01-02' });
    addHistory({ id: 1, title: 'First again', date: '2026-01-03' });
    expect(historyStore.get().map((item) => item.id)).toEqual([1, 2]);
    expect(historyStore.get()[0].title).toBe('First again');
  });
});
