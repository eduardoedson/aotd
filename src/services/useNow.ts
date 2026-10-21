import { useSyncExternalStore } from 'react';

// A single shared one second ticker, so every clock and countdown on screen
// re-renders from the same interval instead of creating one timer each.
let now = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const tick = () => {
  now = Date.now();
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (intervalId === null) {
    now = Date.now();
    intervalId = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
};

const getSnapshot = () => now;

// Returns the current time in milliseconds, refreshed every second.
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
