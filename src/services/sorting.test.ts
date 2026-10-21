import { describe, expect, it, vi } from 'vitest';
import { activeFilterChips, sortItems, type ScheduleFilters } from './filters';
import type { AiringItem } from './queries';

const item = (id: number, title: string, airingAt: number, popularity: number, episode = 1) =>
  ({
    id,
    episode,
    airingAt,
    media: { id, popularity, title: { userPreferred: title } },
  }) as unknown as AiringItem;

const items = [
  item(1, 'Charlie', 300, 50, 2),
  item(2, 'Alpha', 100, 900, 7),
  item(3, 'Bravo', 200, 400, 1),
];
const ids = (list: AiringItem[]) => list.map((entry) => entry.id);

describe('sortItems', () => {
  it('sorts by time, popularity, title and episode without mutating', () => {
    expect(ids(sortItems(items))).toEqual([2, 3, 1]);
    expect(ids(sortItems(items, 'popularity'))).toEqual([2, 3, 1]);
    expect(ids(sortItems([items[0], items[2]], 'popularity'))).toEqual([3, 1]);
    expect(ids(sortItems(items, 'title'))).toEqual([2, 3, 1]);
    expect(ids(sortItems(items, 'episode'))).toEqual([2, 1, 3]);
    expect(ids(items)).toEqual([1, 2, 3]);
  });
});

describe('activeFilterChips', () => {
  it('creates one removable chip per active filter', () => {
    const filters = {
      query: 'frieren',
      genre: 'Fantasy',
      favoritesOnly: true,
      status: 'RELEASING',
      platform: '',
      time: 'night',
      sort: 'popularity',
      setQuery: vi.fn(),
      setGenre: vi.fn(),
      setFavoritesOnly: vi.fn(),
      setStatus: vi.fn(),
      setPlatform: vi.fn(),
      setTime: vi.fn(),
      setSort: vi.fn(),
    } as unknown as ScheduleFilters;

    const chips = activeFilterChips(filters);
    expect(chips.map((chip) => chip.label)).toEqual([
      '"frieren"',
      'Fantasy',
      'Releasing',
      'Night',
      'Favorites',
      'Most popular',
    ]);

    chips.find((chip) => chip.key === 'sort')?.remove();
    expect(filters.setSort).toHaveBeenCalledWith('time');
  });
});
