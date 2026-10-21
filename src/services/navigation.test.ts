import { describe, expect, it } from 'vitest';
import { findNeighbours, scheduleSearch } from './navigation';

const entry = (mediaId: number, date = '2026-10-21') => ({
  mediaId,
  title: `Anime ${mediaId}`,
  date,
  episode: 1,
});

describe('navigation', () => {
  it('finds the previous and next anime of the list', () => {
    const context = { search: '', entries: [entry(1), entry(2), entry(3)] };
    expect(findNeighbours(context, 2)).toMatchObject({
      previous: { mediaId: 1 },
      next: { mediaId: 3 },
    });
    expect(findNeighbours(context, 1).previous).toBeNull();
    expect(findNeighbours(context, 3).next).toBeNull();
    expect(findNeighbours(context, 9)).toEqual({ previous: null, next: null });
    expect(findNeighbours(null, 1)).toEqual({ previous: null, next: null });
  });

  it('skips repeated anime in a week', () => {
    const context = { search: '', entries: [entry(1), entry(2), entry(1, '2026-10-22'), entry(3)] };
    expect(findNeighbours(context, 2).next?.mediaId).toBe(3);
  });

  it('drops the episode parameter from schedule links', () => {
    expect(scheduleSearch('?ep=4&genre=Action')).toBe('?genre=Action');
    expect(scheduleSearch('?ep=4')).toBe('');
  });
});
