import { useEffect, useMemo, useState } from 'react';
import { anilistRequest } from './anilist';
import { peekPersistent, readPersistent, writePersistent } from './persistentCache';

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

// Reads already available data without side effects, so it can run during render.
const readCached = <T>(query: string, variables: Record<string, unknown>) => {
  const cached = cache.get(cacheKey(query, variables));
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.data !== undefined) {
    return cached.data as T;
  }
  return peekPersistent<T>(persistKey(query, variables), PERSIST_FRESH_MS);
};

const variablesFromKey = (key: string) =>
  JSON.parse(key.slice(key.indexOf('::') + 2)) as Record<string, unknown>;

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
  // Holds the last finished request. It belongs to one key only, so results of
  // other variables are ignored below instead of being reset during render.
  const [settled, setSettled] = useState<QueryState<T> | null>(null);

  // Data already in the caches for the current key, shown until the request ends.
  const cachedData = useMemo(
    () => (skip ? undefined : readCached<T>(query, variablesFromKey(key))),
    [query, key, skip],
  );

  useEffect(() => {
    if (skip) return undefined;
    let cancelled = false;
    cachedRequest<T>(query, variablesFromKey(key)).then(
      (data) => {
        if (!cancelled) setSettled({ key, data, error: null });
      },
      (error: unknown) => {
        if (!cancelled) setSettled({ key, data: undefined, error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [query, key, skip]);

  if (skip) return { data: undefined, error: null, loading: false };

  const current = settled?.key === key ? settled : { key, data: cachedData, error: null };
  return {
    data: current.data,
    error: current.error,
    loading: current.data === undefined && !current.error,
  };
}
