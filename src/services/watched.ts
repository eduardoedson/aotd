import { createStorageStore } from './storage';

export type WatchedMap = Record<string, number>;
export const watchedStore = createStorageStore<WatchedMap>('aotd:watched', {});

export function useWatched() {
  const watched = watchedStore.useValue();
  const watchedThrough = (mediaId: number) => watched[mediaId] ?? 0;
  const isWatched = (mediaId: number, episode: number) => watchedThrough(mediaId) >= episode;
  const toggleWatched = (mediaId: number, episode: number) =>
    watchedStore.set((current) => {
      const next = { ...current };
      if ((next[mediaId] ?? 0) >= episode) next[mediaId] = Math.max(0, episode - 1);
      else next[mediaId] = episode;
      if (!next[mediaId]) delete next[mediaId];
      return next;
    });
  return { watched, watchedThrough, isWatched, toggleWatched };
}
