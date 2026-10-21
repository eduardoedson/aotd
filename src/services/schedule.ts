import { useEffect, useReducer } from 'react';
import { anilistRequest } from './anilist';
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

export function fetchSchedulePage(range: UnixRange, page: number): Promise<PageResult> {
  const key = `${rangeKey(range)}:${page}`;
  const cached = pageCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.promise;

  const promise = anilistRequest<ScheduleResponse>(SCHEDULE_QUERY, {
    start: range.start,
    end: range.end,
    page,
    perPage: PER_PAGE,
  }).then((data) => ({
    items: (data?.Page?.airingSchedules ?? []).filter(
      (item): item is AiringItem => Boolean(item?.media?.id) && !item?.media.isAdult,
    ),
    hasNextPage: Boolean(data?.Page?.pageInfo?.hasNextPage),
  }));

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

export function useDaySchedule(date: string, timeZone: TimeZoneMode) {
  const range = getRange(date, 1, timeZone);
  const schedule = useSchedule(range);

  // Warm the cache for the neighbouring days once the first page is visible.
  const firstPageLoaded = schedule.items.length > 0 || !schedule.hasNextPage;
  useEffect(() => {
    if (!firstPageLoaded) return;
    [-1, 1].forEach((offset) => {
      fetchSchedulePage(getRange(shiftIsoDate(date, offset), 1, timeZone), 1).catch(() => {});
    });
  }, [date, timeZone, firstPageLoaded]);

  return schedule;
}
