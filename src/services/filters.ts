import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { normalizeSearch } from './globals';
import type { AiringItem } from './queries';

const NAVIGATION_OPTIONS = { replace: true, preventScrollReset: true };

export type ScheduleView = 'day' | 'week';

export interface FilterValues {
  query: string;
  genre: string;
  favoritesOnly: boolean;
  status?: string;
  platform?: string;
}

export interface ScheduleFilters extends FilterValues {
  view: ScheduleView;
  active: boolean;
  setQuery: (value: string) => void;
  setGenre: (value: string) => void;
  setFavoritesOnly: (value: boolean) => void;
  setStatus: (value: string) => void;
  setPlatform: (value: string) => void;
  setView: (value: ScheduleView) => void;
  clear: () => void;
}

// Filters and the view mode live in the URL (?q=&genre=&fav=1&view=week),
// so they survive reloads and can be shared.
export function useScheduleFilters(): ScheduleFilters {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const genre = searchParams.get('genre') ?? '';
  const favoritesOnly = searchParams.get('fav') === '1';
  const status = searchParams.get('status') ?? '';
  const platform = searchParams.get('platform') ?? '';
  const view: ScheduleView = searchParams.get('view') === 'week' ? 'week' : 'day';

  // Two quick changes (clear, then type) can happen before React Router renders
  // the first one, so updates build on the latest params written here, not on
  // the possibly stale ones from the last render.
  const latest = useRef(searchParams);
  useEffect(() => {
    latest.current = searchParams;
  }, [searchParams]);

  const write = (next: URLSearchParams) => {
    latest.current = next;
    setSearchParams(next, NAVIGATION_OPTIONS);
  };

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(latest.current);
    if (value) next.set(key, value);
    else next.delete(key);
    write(next);
  };

  return {
    query,
    genre,
    favoritesOnly,
    status,
    platform,
    view,
    active: Boolean(query || genre || favoritesOnly || status || platform),
    setQuery: (value) => update('q', value),
    setGenre: (value) => update('genre', value),
    setFavoritesOnly: (value) => update('fav', value ? '1' : ''),
    setStatus: (value) => update('status', value),
    setPlatform: (value) => update('platform', value),
    setView: (value) => update('view', value === 'week' ? 'week' : ''),
    clear: () => {
      const next = new URLSearchParams();
      const currentView = latest.current.get('view');
      if (currentView) next.set('view', currentView);
      write(next);
    },
  };
}

export function matchesFilters(
  item: AiringItem,
  { query, genre, favoritesOnly, status = '', platform = '' }: FilterValues,
  isFavorite: (id: number) => boolean,
) {
  const { media } = item;
  if (favoritesOnly && !isFavorite(media.id)) return false;
  if (genre && !(media.genres ?? []).includes(genre)) return false;
  if (status && media.status !== status) return false;
  if (platform && !(media.externalLinks ?? []).some((link) => link.site === platform)) return false;

  const needle = normalizeSearch(query);
  if (!needle) return true;

  return [media.title?.userPreferred, media.title?.romaji, media.title?.english]
    .filter((title): title is string => Boolean(title))
    .some((title) => normalizeSearch(title).includes(needle));
}

// Airing order, as a copy so the loaded list is never mutated.
export const byAiringTime = (items: AiringItem[]) =>
  [...items].sort((a, b) => a.airingAt - b.airingAt);

const STATUS_LABELS: Record<string, string> = {
  RELEASING: 'Releasing',
  FINISHED: 'Finished',
  NOT_YET_RELEASED: 'Upcoming',
};

export interface FilterChip {
  key: string;
  label: string;
  remove: () => void;
}

// One removable chip per active filter, shown under the filter bar.
export function activeFilterChips(filters: ScheduleFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.query) {
    chips.push({ key: 'q', label: `"${filters.query}"`, remove: () => filters.setQuery('') });
  }
  if (filters.genre) {
    chips.push({ key: 'genre', label: filters.genre, remove: () => filters.setGenre('') });
  }
  if (filters.status) {
    chips.push({
      key: 'status',
      label: STATUS_LABELS[filters.status] ?? filters.status,
      remove: () => filters.setStatus(''),
    });
  }
  if (filters.platform) {
    chips.push({ key: 'platform', label: filters.platform, remove: () => filters.setPlatform('') });
  }
  if (filters.favoritesOnly) {
    chips.push({ key: 'fav', label: 'Favorites', remove: () => filters.setFavoritesOnly(false) });
  }
  return chips;
}
