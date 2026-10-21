import { useEffect, useState } from 'react';
import { anilistRequest } from './anilist';
import { readPersistent, writePersistent } from './persistentCache';

const CACHE_TTL_MS = 10 * 60 * 1000;
// Detail data changes rarely: a persisted copy is reused for 30 minutes and is
// still shown, up to a week old, when AniList cannot be reached.
const PERSIST_FRESH_MS = 30 * 60 * 1000;
const PERSIST_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  promise: Promise<unknown>;
  data?: unknown;
  fetchedAt: number;
}

// Shared in memory cache, so going back to a page shows it instantly.
const cache = new Map<string, CacheEntry>();

export const clearQueryCache = () => cache.clear();

const cacheKey = (query: string, variables: Record<string, unknown>) =>
  `${query}::${JSON.stringify(variables)}`;

// Short key for localStorage: operation name plus variables.
const persistKey = (query: string, variables: Record<string, unknown>) =>
  `${query.match(/query\s+(\w+)/)?.[1] ?? 'query'}:${JSON.stringify(variables)}`;

// Runs a query through the caches. Concurrent callers share a single request.
export function cachedRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = cacheKey(query, variables);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.promise as Promise<T>;

  const storageKey = persistKey(query, variables);
  const entry: CacheEntry = { promise: Promise.resolve(), fetchedAt: Date.now() };
  const persisted = readPersistent<T>(storageKey, PERSIST_FRESH_MS);

  if (persisted !== undefined) {
    entry.data = persisted;
    entry.promise = Promise.resolve(persisted);
  } else {
    entry.promise = anilistRequest<T>(query, variables).then(
      (data) => {
        entry.data = data;
        writePersistent(storageKey, data);
        return data;
      },
      (error: unknown) => {
        const fallback = readPersistent<T>(storageKey, PERSIST_FALLBACK_MS);
        if (fallback !== undefined) {
          entry.data = fallback;
          return fallback;
        }
        cache.delete(key);
        throw error;
      },
    );
  }
  cache.set(key, entry);
  return entry.promise as Promise<T>;
}

const readCached = <T>(query: string, variables: Record<string, unknown>) => {
  const cached = cache.get(cacheKey(query, variables));
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.data !== undefined) {
    return cached.data as T;
  }
  return readPersistent<T>(persistKey(query, variables), PERSIST_FRESH_MS);
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
