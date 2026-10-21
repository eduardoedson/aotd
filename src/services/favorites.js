import { useCallback } from 'react';
import { createStorageStore } from './storage';

const EMPTY = Object.freeze({});

export const favoritesStore = createStorageStore('aotd:favorites', EMPTY);

const sanitizeFavorites = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : EMPTY;

export const getFavorites = () => sanitizeFavorites(favoritesStore.get());

export const toggleFavorite = ({ id, title, image }) => {
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
  const isFavorite = useCallback((id) => Boolean(favorites[id]), [favorites]);
  return { favorites, isFavorite, toggleFavorite };
}
