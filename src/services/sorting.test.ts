import { describe, expect, it, vi } from 'vitest';
import { activeFilterChips, byAiringTime, type ScheduleFilters } from './filters';
import type { AiringItem } from './queries';

const item = (id: number, airingAt: number) =>
  ({
    id,
    episode: 1,
    airingAt,
    media: { id, title: { userPreferred: `Anime ${id}` } },
  }) as unknown as AiringItem;

describe('byAiringTime', () => {
  it('sorts by airing time without mutating the list', () => {
    const items = [item(1, 300), item(2, 100), item(3, 200)];
    expect(byAiringTime(items).map((entry) => entry.id)).toEqual([2, 3, 1]);
    expect(items.map((entry) => entry.id)).toEqual([1, 2, 3]);
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
      setQuery: vi.fn(),
      setGenre: vi.fn(),
      setFavoritesOnly: vi.fn(),
      setStatus: vi.fn(),
      setPlatform: vi.fn(),
    } as unknown as ScheduleFilters;

    const chips = activeFilterChips(filters);
    expect(chips.map((chip) => chip.label)).toEqual([
      '"frieren"',
      'Fantasy',
      'Releasing',
      'Favorites',
    ]);

    chips.find((chip) => chip.key === 'genre')?.remove();
    expect(filters.setGenre).toHaveBeenCalledWith('');
  });
});
