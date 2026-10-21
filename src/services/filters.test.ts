import { describe, expect, it } from 'vitest';
import { matchesFilters, type FilterValues } from './filters';
import type { AiringItem } from './queries';

const item = {
  id: 10,
  episode: 1,
  airingAt: 0,
  media: {
    id: 1,
    genres: ['Fantasy', 'Adventure'],
    title: { userPreferred: 'Sousou no Frieren', romaji: 'Sousou no Frieren', english: 'Frieren' },
  },
} as unknown as AiringItem;

const none = () => false;
const filters = (overrides: Partial<FilterValues>): FilterValues => ({
  query: '',
  genre: '',
  favoritesOnly: false,
  ...overrides,
});

describe('matchesFilters', () => {
  it('matches every title variant ignoring accents and case', () => {
    expect(matchesFilters(item, filters({ query: 'FRIÉREN' }), none)).toBe(true);
    expect(matchesFilters(item, filters({ query: 'naruto' }), none)).toBe(false);
  });

  it('filters by genre and favorites', () => {
    expect(matchesFilters(item, filters({ genre: 'Fantasy' }), none)).toBe(true);
    expect(matchesFilters(item, filters({ genre: 'Action' }), none)).toBe(false);
    expect(matchesFilters(item, filters({ favoritesOnly: true }), none)).toBe(false);
    expect(matchesFilters(item, filters({ favoritesOnly: true }), () => true)).toBe(true);
  });
});
