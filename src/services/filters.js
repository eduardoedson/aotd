import { useSearchParams } from 'react-router-dom';
import { normalizeSearch } from './globals';

const NAVIGATION_OPTIONS = { replace: true, preventScrollReset: true };

// Filters live in the URL (?q=&genre=&fav=1) so they survive reloads and can be shared.
export function useScheduleFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const genre = searchParams.get('genre') ?? '';
  const favoritesOnly = searchParams.get('fav') === '1';

  const update = (key, value) =>
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
    active: Boolean(query || genre || favoritesOnly),
    setQuery: (value) => update('q', value),
    setGenre: (value) => update('genre', value),
    setFavoritesOnly: (value) => update('fav', value ? '1' : ''),
    clear: () => setSearchParams(new URLSearchParams(), NAVIGATION_OPTIONS),
  };
}

export function matchesFilters(item, { query, genre, favoritesOnly }, isFavorite) {
  const { media } = item;
  if (favoritesOnly && !isFavorite(media.id)) return false;
  if (genre && !(media.genres ?? []).includes(genre)) return false;

  const needle = normalizeSearch(query);
  if (!needle) return true;

  return [media.title?.userPreferred, media.title?.romaji, media.title?.english]
    .filter(Boolean)
    .some((title) => normalizeSearch(title).includes(needle));
}
