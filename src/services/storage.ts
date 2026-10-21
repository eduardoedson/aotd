import { useSyncExternalStore } from 'react';

export interface StorageStore<T> {
  get: () => T;
  set: (updater: T | ((current: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
  reset: () => void;
  useValue: () => T;
}

// Creates a tiny store backed by localStorage that stays in sync across tabs.
// Every access is wrapped in try/catch because storage can be blocked or unavailable.
export function createStorageStore<T>(key: string, fallback: T): StorageStore<T> {
  let snapshot: T = fallback;
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = () => {
    try {
      const raw = window.localStorage.getItem(key);
      snapshot = raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      snapshot = fallback;
    }
    loaded = true;
  };

  const notify = () => listeners.forEach((listener) => listener());

  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      load();
      notify();
    }
  };

  const get = () => {
    if (!loaded) load();
    return snapshot;
  };

  const set: StorageStore<T>['set'] = (updater) => {
    const next = typeof updater === 'function' ? (updater as (current: T) => T)(get()) : updater;
    snapshot = next;
    loaded = true;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage is unavailable, keep the value in memory only.
    }
    notify();
  };

  const subscribe = (listener: () => void) => {
    if (listeners.size === 0) window.addEventListener('storage', onStorage);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) window.removeEventListener('storage', onStorage);
    };
  };

  // Used by tests to start from a clean state.
  const reset = () => {
    loaded = false;
    snapshot = fallback;
  };

  const getServerSnapshot = () => fallback;
  const useValue = () => useSyncExternalStore(subscribe, get, getServerSnapshot);

  return { get, set, subscribe, reset, useValue };
}

// Same idea without persistence, for UI state shared by distant components.
export function createMemoryStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  const get = () => value;
  const set = (next: T) => {
    value = next;
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const useValue = () => useSyncExternalStore(subscribe, get, get);
  return { get, set, subscribe, useValue };
}
