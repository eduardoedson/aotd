import { useSyncExternalStore } from 'react';

// Creates a tiny store backed by localStorage that stays in sync across tabs.
// Every access is wrapped in try/catch because storage can be blocked or unavailable.
export function createStorageStore(key, fallback) {
  let snapshot;
  let loaded = false;
  const listeners = new Set();

  const load = () => {
    try {
      const raw = window.localStorage.getItem(key);
      snapshot = raw === null ? fallback : JSON.parse(raw);
    } catch {
      snapshot = fallback;
    }
    loaded = true;
  };

  const notify = () => listeners.forEach((listener) => listener());

  const onStorage = (event) => {
    if (event.key === key || event.key === null) {
      load();
      notify();
    }
  };

  const get = () => {
    if (!loaded) load();
    return snapshot;
  };

  const set = (updater) => {
    const next = typeof updater === 'function' ? updater(get()) : updater;
    snapshot = next;
    loaded = true;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage is unavailable, keep the value in memory only.
    }
    notify();
  };

  const subscribe = (listener) => {
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
    snapshot = undefined;
  };

  const useValue = () => useSyncExternalStore(subscribe, get, () => fallback);

  return { get, set, subscribe, reset, useValue };
}
