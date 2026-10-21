import { useCallback } from 'react';
import { createStorageStore } from './storage';

export interface Favorite {
  id: number;
  title: string;
  image?: string | null;
  addedAt?: number;
  // Per anime release notifications; missing means enabled.
  notify?: boolean;
}

export type Favorites = Record<string, Favorite>;

const EMPTY: Favorites = Object.freeze({}) as Favorites;

export const favoritesStore = createStorageStore<Favorites>('aotd:favorites', EMPTY);

const sanitizeFavorites = (value: unknown): Favorites =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Favorites) : EMPTY;

export const getFavorites = () => sanitizeFavorites(favoritesStore.get());

export const getFavoriteIds = () =>
  Object.keys(getFavorites())
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

// Favorites whose release notifications are enabled.
export const getNotifyIds = () =>
  Object.values(getFavorites())
    .filter((favorite) => favorite.notify !== false)
    .map((favorite) => Number(favorite.id))
    .filter((id) => Number.isInteger(id) && id > 0);

export const setFavoriteNotify = (id: number, notify: boolean) => {
  favoritesStore.set((current) => {
    const favorites = sanitizeFavorites(current);
    if (!favorites[id]) return favorites;
    return { ...favorites, [id]: { ...favorites[id], notify } };
  });
};

export const toggleFavorite = ({ id, title, image }: Favorite) => {
  favoritesStore.set((current) => {
    const next = { ...sanitizeFavorites(current) };
    if (next[id]) {
      delete next[id];
    } else {
      next[id] = { id, title, image: image ?? null, addedAt: Date.now() };
    }
    return next;
  });
};

export function useFavorites() {
  const favorites = sanitizeFavorites(favoritesStore.useValue());
  const isFavorite = useCallback((id: number) => Boolean(favorites[id]), [favorites]);
  const notifiesFor = useCallback(
    (id: number) => Boolean(favorites[id]) && favorites[id].notify !== false,
    [favorites],
  );
  return { favorites, isFavorite, notifiesFor, toggleFavorite, setFavoriteNotify };
}
