import { useSearchParams } from 'react-router-dom';
import { normalizeSearch } from './globals';
import type { AiringItem } from './queries';

const NAVIGATION_OPTIONS = { replace: true, preventScrollReset: true };

export type ScheduleView = 'day' | 'week';

export interface FilterValues {
  query: string;
  genre: string;
  favoritesOnly: boolean;
}

export interface ScheduleFilters extends FilterValues {
  view: ScheduleView;
  active: boolean;
  setQuery: (value: string) => void;
  setGenre: (value: string) => void;
  setFavoritesOnly: (value: boolean) => void;
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
  const view: ScheduleView = searchParams.get('view') === 'week' ? 'week' : 'day';

  const update = (key: string, value: string) =>
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, NAVIGATION_OPTIONS);

  return {
    query,
    genre,
    favoritesOnly,
    view,
    active: Boolean(query || genre || favoritesOnly),
    setQuery: (value) => update('q', value),
    setGenre: (value) => update('genre', value),
    setFavoritesOnly: (value) => update('fav', value ? '1' : ''),
    setView: (value) => update('view', value === 'week' ? 'week' : ''),
    clear: () =>
      setSearchParams((previous) => {
        const next = new URLSearchParams();
        const currentView = previous.get('view');
        if (currentView) next.set('view', currentView);
        return next;
      }, NAVIGATION_OPTIONS),
  };
}

export function matchesFilters(
  item: AiringItem,
  { query, genre, favoritesOnly }: FilterValues,
  isFavorite: (id: number) => boolean,
) {
  const { media } = item;
  if (favoritesOnly && !isFavorite(media.id)) return false;
  if (genre && !(media.genres ?? []).includes(genre)) return false;

  const needle = normalizeSearch(query);
  if (!needle) return true;

  return [media.title?.userPreferred, media.title?.romaji, media.title?.english]
    .filter((title): title is string => Boolean(title))
    .some((title) => normalizeSearch(title).includes(needle));
}
