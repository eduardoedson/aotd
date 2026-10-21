import { useEffect, useReducer } from 'react';
import { gql, useApolloClient } from '@apollo/client';
import { getDayRange, shiftIsoDate } from './globals';

export const PER_PAGE = 50;
const CACHE_TTL_MS = 10 * 60 * 1000;

export const SCHEDULE_QUERY = gql`
  query DaySchedule($start: Int, $end: Int, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
      }
      airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
        id
        episode
        airingAt
        media {
          id
          isAdult
          siteUrl
          duration
          genres
          description(asHtml: false)
          title {
            userPreferred
            romaji
            english
          }
          coverImage {
            extraLarge
            color
          }
          externalLinks {
            id
            site
            icon
            url
          }
        }
      }
    }
  }
`;

// Pages already fetched, keyed by "date:page". Promises are stored so concurrent
// callers (StrictMode, prefetching) share a single network request.
const pageCache = new Map();
// Remembers how many pages were loaded per day so coming back restores the list.
const loadedPagesByDate = new Map();

export const clearScheduleCache = () => {
  pageCache.clear();
  loadedPagesByDate.clear();
};

export function fetchSchedulePage(client, date, page) {
  const key = `${date}:${page}`;
  const cached = pageCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.promise;

  const { start, end } = getDayRange(date);
  const promise = client
    .query({
      query: SCHEDULE_QUERY,
      variables: { start, end, page, perPage: PER_PAGE },
      fetchPolicy: 'no-cache',
    })
    .then(({ data }) => ({
      items: (data?.Page?.airingSchedules ?? []).filter(
        (item) => item?.media?.id && !item.media.isAdult,
      ),
      hasNextPage: Boolean(data?.Page?.pageInfo?.hasNextPage),
    }));

  pageCache.set(key, { promise, fetchedAt: Date.now() });
  promise.catch(() => pageCache.delete(key));
  return promise;
}

const createInitialState = (date) => ({
  items: [],
  page: 0,
  requestedPage: Math.max(1, loadedPagesByDate.get(date) ?? 1),
  hasNextPage: true,
  error: null,
});

function reducer(state, action) {
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

// Loads the airing schedule of one day page by page. The component using it
// should be keyed by date so a new day starts from a fresh state.
export function useDaySchedule(date) {
  const client = useApolloClient();
  const [state, dispatch] = useReducer(reducer, date, createInitialState);
  const nextPage = state.page + 1;
  const shouldLoad = !state.error && state.hasNextPage && state.requestedPage >= nextPage;

  useEffect(() => {
    if (!shouldLoad) return undefined;
    let cancelled = false;

    fetchSchedulePage(client, date, nextPage)
      .then((result) => {
        if (cancelled) return;
        loadedPagesByDate.set(date, nextPage);
        dispatch({ type: 'loaded', page: nextPage, ...result });
      })
      .catch((error) => {
        if (!cancelled) dispatch({ type: 'failed', error });
      });

    return () => {
      cancelled = true;
    };
  }, [client, date, nextPage, shouldLoad]);

  // Warm the cache for the neighbouring days once the first page is visible.
  const firstPageLoaded = state.page >= 1;
  useEffect(() => {
    if (!firstPageLoaded) return;
    [-1, 1].forEach((offset) => {
      fetchSchedulePage(client, shiftIsoDate(date, offset), 1).catch(() => {});
    });
  }, [client, date, firstPageLoaded]);

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
