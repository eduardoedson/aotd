import { useEffect, useMemo, useState } from 'react';
import { anilistRequest } from './anilist';
import {
  peekPersistent,
  readPersistent,
  readPersistentEntry,
  writePersistent,
} from './persistentCache';
import { pruneMap } from './boundedCache';

const CACHE_TTL_MS = 10 * 60 * 1000;
// Detail data changes rarely: a persisted copy is reused for 30 minutes and is
// still shown, up to a week old, when AniList cannot be reached.
const PERSIST_FRESH_MS = 30 * 60 * 1000;
const PERSIST_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;
// Searches add one entry per query typed, so the memory cache keeps only the latest.
export const MAX_MEMORY_ENTRIES = 100;

type Variables = Record<string, unknown>;

interface CacheEntry {
  promise: Promise<unknown>;
  data?: unknown;
  fetchedAt: number;
  // Set when AniList failed and an older saved copy is shown instead.
  staleSince?: number;
}

// Shared in memory cache, so going back to a page shows it instantly.
const cache = new Map<string, CacheEntry>();

export const clearQueryCache = () => cache.clear();

export const getQueryCacheSize = () => cache.size;

const cacheKey = (query: string, variables: Variables) => `${query}::${JSON.stringify(variables)}`;

// Short key for localStorage: operation name plus variables.
const persistKey = (query: string, variables: Variables) =>
  `${query.match(/query\s+(\w+)/)?.[1] ?? 'query'}:${JSON.stringify(variables)}`;

const isFresh = (entry: CacheEntry | undefined): entry is CacheEntry =>
  Boolean(entry) && Date.now() - (entry as CacheEntry).fetchedAt < CACHE_TTL_MS;

// Runs a query through the caches. Concurrent callers share a single request.
export function cachedRequest<T>(query: string, variables: Variables): Promise<T> {
  const key = cacheKey(query, variables);
  const cached = cache.get(key);
  if (isFresh(cached)) return cached.promise as Promise<T>;

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
        const fallback = readPersistentEntry<T>(storageKey, PERSIST_FALLBACK_MS);
        if (fallback !== undefined) {
          entry.data = fallback.data;
          entry.staleSince = fallback.savedAt;
          return fallback.data;
        }
        cache.delete(key);
        throw error;
      },
    );
  }
  cache.delete(key);
  cache.set(key, entry);
  pruneMap(cache, {
    maxEntries: MAX_MEMORY_ENTRIES,
    // Entries still loading are kept, so concurrent callers keep sharing them.
    isExpired: (value) => value.data !== undefined && !isFresh(value),
  });
  return entry.promise as Promise<T>;
}

// When the data on screen is an offline copy, the time it was saved.
const getStaleSince = (query: string, variables: Variables) =>
  cache.get(cacheKey(query, variables))?.staleSince ?? null;

// Oldest save time among the results, or null when everything is live data.
const oldestStaleSince = (query: string, variablesList: Variables[]) =>
  variablesList.reduce<number | null>((oldest, variables) => {
    const since = getStaleSince(query, variables);
    if (since === null) return oldest;
    return oldest === null ? since : Math.min(oldest, since);
  }, null);

// Reads already available data without side effects, so it can run during render.
const readCached = <T>(query: string, variables: Variables) => {
  const cached = cache.get(cacheKey(query, variables));
  if (isFresh(cached) && cached.data !== undefined) return cached.data as T;
  return peekPersistent<T>(persistKey(query, variables), PERSIST_FRESH_MS);
};

interface QueryState<T> {
  key: string;
  data: T[] | undefined;
  error: unknown;
  staleSince: number | null;
}

export interface QueryResult<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  // Set when AniList could not be reached and saved data is shown instead.
  staleSince: number | null;
}

// Runs the same query once per variables object (for example one per batch of
// ids) and returns every result in order, once all of them are available.
export function useAnilistQueries<T>(
  query: string,
  variablesList: Variables[],
  { skip = false }: { skip?: boolean } = {},
): QueryResult<T[]> {
  const key = `${query}::${JSON.stringify(variablesList)}`;
  // Holds the last finished request. It belongs to one key only, so results of
  // other variables are ignored below instead of being reset during render.
  const [settled, setSettled] = useState<QueryState<T> | null>(null);

  // Data already in the caches for the current key, shown until the requests end.
  const cachedState = useMemo((): QueryState<T> => {
    const list = JSON.parse(key.slice(query.length + 2)) as Variables[];
    if (skip) return { key, data: undefined, error: null, staleSince: null };
    const results = list.map((variables) => readCached<T>(query, variables));
    const complete = results.every((result) => result !== undefined);
    return {
      key,
      data: complete ? (results as T[]) : undefined,
      error: null,
      staleSince: complete ? oldestStaleSince(query, list) : null,
    };
  }, [query, key, skip]);

  useEffect(() => {
    if (skip) return undefined;
    let cancelled = false;
    const list = JSON.parse(key.slice(query.length + 2)) as Variables[];
    Promise.all(list.map((variables) => cachedRequest<T>(query, variables))).then(
      (data) => {
        if (!cancelled) {
          setSettled({ key, data, error: null, staleSince: oldestStaleSince(query, list) });
        }
      },
      (error: unknown) => {
        if (!cancelled) setSettled({ key, data: undefined, error, staleSince: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [query, key, skip]);

  if (skip) return { data: undefined, error: null, loading: false, staleSince: null };

  const current = settled?.key === key ? settled : cachedState;
  return {
    data: current.data,
    error: current.error,
    loading: current.data === undefined && !current.error,
    staleSince: current.staleSince,
  };
}

export function useAnilistQuery<T>(
  query: string,
  variables: Variables,
  options: { skip?: boolean } = {},
): QueryResult<T> {
  const variablesList = useMemo(() => [variables], [variables]);
  const result = useAnilistQueries<T>(query, variablesList, options);
  return { ...result, data: result.data?.[0] };
}
