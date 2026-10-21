import { useEffect, useState } from 'react';
import { anilistRequest } from './anilist';

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  promise: Promise<unknown>;
  data?: unknown;
  fetchedAt: number;
}

// Shared response cache, so going back to a page shows it instantly.
const cache = new Map<string, CacheEntry>();

export const clearQueryCache = () => cache.clear();

const cacheKey = (query: string, variables: Record<string, unknown>) =>
  `${query}::${JSON.stringify(variables)}`;

// Runs a query through the cache. Concurrent callers share a single request.
export function cachedRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = cacheKey(query, variables);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.promise as Promise<T>;

  const entry: CacheEntry = { promise: Promise.resolve(), fetchedAt: Date.now() };
  entry.promise = anilistRequest<T>(query, variables).then((data) => {
    entry.data = data;
    return data;
  });
  entry.promise.catch(() => cache.delete(key));
  cache.set(key, entry);
  return entry.promise as Promise<T>;
}

const readCached = <T>(query: string, variables: Record<string, unknown>) => {
  const cached = cache.get(cacheKey(query, variables));
  return cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS
    ? (cached.data as T | undefined)
    : undefined;
};

interface QueryState<T> {
  key: string;
  data: T | undefined;
  error: unknown;
}

export function useAnilistQuery<T>(
  query: string,
  variables: Record<string, unknown>,
  { skip = false }: { skip?: boolean } = {},
) {
  const key = cacheKey(query, variables);
  const [state, setState] = useState<QueryState<T>>(() => ({
    key,
    data: skip ? undefined : readCached<T>(query, variables),
    error: null,
  }));

  // Reset synchronously when the variables change, so stale data is never shown.
  let current = state;
  if (state.key !== key) {
    current = { key, data: skip ? undefined : readCached<T>(query, variables), error: null };
    setState(current);
  }

  useEffect(() => {
    if (skip) return undefined;
    let cancelled = false;
    const vars = JSON.parse(key.slice(key.indexOf('::') + 2)) as Record<string, unknown>;
    cachedRequest<T>(query, vars).then(
      (data) => {
        if (!cancelled) setState({ key, data, error: null });
      },
      (error: unknown) => {
        if (!cancelled) setState({ key, data: undefined, error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [query, key, skip]);

  const ready = current.key === key;
  return {
    data: ready ? current.data : undefined,
    error: ready ? current.error : null,
    loading: !skip && (!ready || (current.data === undefined && !current.error)),
  };
}
