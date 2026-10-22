// Title search across the whole AniList catalogue, not only the day on screen.

import { useEffect, useMemo, useState } from 'react';
import { useAnilistQuery } from './useAnilistQuery';

const SEARCH_QUERY = /* GraphQL */ `
  query SearchAnime($search: String, $perPage: Int) {
    Page(perPage: $perPage) {
      media(search: $search, type: ANIME, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
        id
        status
        format
        episodes
        seasonYear
        title {
          userPreferred
        }
        coverImage {
          medium
          large
          color
        }
        nextAiringEpisode {
          episode
          airingAt
        }
      }
    }
  }
`;

export interface SearchResult {
  id: number;
  status: string | null;
  format: string | null;
  episodes: number | null;
  seasonYear: number | null;
  title: { userPreferred: string | null } | null;
  coverImage: { medium: string | null; large: string | null; color: string | null } | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
}

interface SearchResponse {
  Page: { media: SearchResult[] } | null;
}

export const MIN_SEARCH_LENGTH = 2;
const SEARCH_DELAY_MS = 350;
const PER_PAGE = 12;

// Returns the value only after it stopped changing for "delay" milliseconds.
function useDebouncedValue<T>(value: T, delay = SEARCH_DELAY_MS) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useTitleSearch(query: string) {
  const debounced = useDebouncedValue(query.trim());
  const enabled = debounced.length >= MIN_SEARCH_LENGTH;
  const variables = useMemo(() => ({ search: debounced, perPage: PER_PAGE }), [debounced]);
  const { data, error, loading } = useAnilistQuery<SearchResponse>(SEARCH_QUERY, variables, {
    skip: !enabled,
  });

  return {
    enabled,
    // Still typing: the visible results belong to an older query.
    pending: query.trim() !== debounced,
    loading: enabled && loading,
    error,
    results: enabled ? (data?.Page?.media ?? []) : [],
    search: debounced,
  };
}
