import { useEffect, useReducer } from 'react';
import { anilistRequest } from './anilist';
import { readPersistent, writePersistent } from './persistentCache';
import { canPrefetch } from './prefetch';
import { getRange, shiftIsoDate, type TimeZoneMode, type UnixRange } from './globals';
import { SCHEDULE_QUERY, type AiringItem, type ScheduleResponse } from './queries';

export const PER_PAGE = 50;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface PageResult {
  items: AiringItem[];
  hasNextPage: boolean;
}

// Pages already fetched, keyed by "start:end:page". Promises are stored so concurrent
// callers (StrictMode, prefetching) share a single network request.
const pageCache = new Map<string, { promise: Promise<PageResult>; fetchedAt: number }>();
// Remembers how many pages were loaded per range so coming back restores the list.
const loadedPagesByRange = new Map<string, number>();

export const clearScheduleCache = () => {
  pageCache.clear();
  loadedPagesByRange.clear();
};

const rangeKey = ({ start, end }: UnixRange) => `${start}:${end}`;

// Persisted pages are reused for the same 10 minutes after a reload, and kept
// for a day as an offline fallback.
const PERSIST_FALLBACK_MS = 24 * 60 * 60 * 1000;

const toResult = (data: ScheduleResponse): PageResult => ({
  // Adult titles are kept here and hidden by the components, which know the
  // visitor's "show adult titles" preference.
  items: (data?.Page?.airingSchedules ?? []).filter((item): item is AiringItem =>
    Boolean(item?.media?.id),
  ),
  hasNextPage: Boolean(data?.Page?.pageInfo?.hasNextPage),
});

export function fetchSchedulePage(range: UnixRange, page: number): Promise<PageResult> {
  const key = `${rangeKey(range)}:${page}`;
  const cached = pageCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.promise;

  const storageKey = `schedule:${key}`;
  const persisted = readPersistent<PageResult>(storageKey, CACHE_TTL_MS);
  const promise = persisted
    ? Promise.resolve(persisted)
    : anilistRequest<ScheduleResponse>(SCHEDULE_QUERY, {
        start: range.start,
        end: range.end,
        page,
        perPage: PER_PAGE,
      }).then(
        (data) => {
          const result = toResult(data);
          writePersistent(storageKey, result);
          return result;
        },
        (error: unknown) => {
          const fallback = readPersistent<PageResult>(storageKey, PERSIST_FALLBACK_MS);
          if (fallback) return fallback;
          throw error;
        },
      );

  pageCache.set(key, { promise, fetchedAt: Date.now() });
  promise.catch(() => pageCache.delete(key));
  return promise;
}

interface State {
  items: AiringItem[];
  page: number;
  requestedPage: number;
  hasNextPage: boolean;
  error: unknown;
}

type Action =
  | { type: 'loaded'; page: number; items: AiringItem[]; hasNextPage: boolean }
  | { type: 'failed'; error: unknown }
  | { type: 'more' }
  | { type: 'retry' };

const createInitialState = (key: string): State => ({
  items: [],
  page: 0,
  requestedPage: Math.max(1, loadedPagesByRange.get(key) ?? 1),
  hasNextPage: true,
  error: null,
});

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded': {
      if (action.page !== state.page + 1) return state;
      const seen = new Set(state.items.map((item) => item.id));
      const fresh = action.items.filter((item) => !seen.has(item.id));
      return {
        ...state,
        items: [...state.items, ...fresh],
        page: action.page,
        hasNextPage: action.hasNextPage,
        requestedPage: action.hasNextPage ? state.requestedPage : action.page,
      };
    }
    case 'failed':
      return { ...state, error: action.error };
    case 'more':
      if (!state.hasNextPage || state.error || state.requestedPage > state.page) return state;
      return { ...state, requestedPage: state.page + 1 };
    case 'retry':
      return { ...state, error: null };
    default:
      return state;
  }
}

interface ScheduleOptions {
  // Keep loading every page automatically (used by the week view).
  loadAll?: boolean;
}

// Loads the airing schedule of a time range page by page. The component using it
// should be keyed by the range so a new range starts from a fresh state.
export function useSchedule(range: UnixRange, { loadAll = false }: ScheduleOptions = {}) {
  const key = rangeKey(range);
  const [state, dispatch] = useReducer(reducer, key, createInitialState);
  const nextPage = state.page + 1;
  const wantsMore = loadAll || state.requestedPage >= nextPage;
  const shouldLoad = !state.error && state.hasNextPage && wantsMore;
  const { start, end } = range;

  useEffect(() => {
    if (!shouldLoad) return undefined;
    let cancelled = false;

    fetchSchedulePage({ start, end }, nextPage)
      .then((result) => {
        if (cancelled) return;
        loadedPagesByRange.set(`${start}:${end}`, nextPage);
        dispatch({ type: 'loaded', page: nextPage, ...result });
      })
      .catch((error: unknown) => {
        if (!cancelled) dispatch({ type: 'failed', error });
      });

    return () => {
      cancelled = true;
    };
  }, [start, end, nextPage, shouldLoad]);

  return {
    items: state.items,
    error: state.error,
    hasNextPage: state.hasNextPage,
    loading: shouldLoad,
    initialLoading: shouldLoad && state.page === 0,
    loadMore: () => dispatch({ type: 'more' }),
    retry: () => dispatch({ type: 'retry' }),
  };
}

// With filters active every page is loaded, so the matches cover the whole day.
export function useDaySchedule(date: string, timeZone: TimeZoneMode, { loadAll = false } = {}) {
  const range = getRange(date, 1, timeZone);
  const schedule = useSchedule(range, { loadAll });

  // Warm the cache for the neighbouring days once the first page is visible.
  const firstPageLoaded = schedule.items.length > 0 || !schedule.hasNextPage;
  useEffect(() => {
    if (!firstPageLoaded) return;
    // Selective preload: only on fast, unmetered connections. The next day is the
    // most likely destination; the previous one is fetched after it.
    if (!canPrefetch()) return;
    fetchSchedulePage(getRange(shiftIsoDate(date, 1), 1, timeZone), 1)
      .then(() => fetchSchedulePage(getRange(shiftIsoDate(date, -1), 1, timeZone), 1))
      .catch(() => {});
  }, [date, timeZone, firstPageLoaded]);

  return schedule;
}
