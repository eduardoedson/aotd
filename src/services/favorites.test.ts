import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  favoritesStore,
  getFavoriteIds,
  getFavorites,
  getNotifyIds,
  setFavoriteNotify,
  toggleFavorite,
  useFavorites,
} from './favorites';

afterEach(() => favoritesStore.reset());

describe('favorites', () => {
  it('toggles favorites and persists them', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.isFavorite(1)).toBe(false);

    act(() => toggleFavorite({ id: 1, title: 'Frieren', image: null }));
    expect(result.current.isFavorite(1)).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('aotd:favorites') ?? '{}')[1].title).toBe(
      'Frieren',
    );
    expect(getFavoriteIds()).toEqual([1]);

    act(() => toggleFavorite({ id: 1, title: 'Frieren', image: null }));
    expect(result.current.isFavorite(1)).toBe(false);
  });

  it('ignores corrupted storage', () => {
    window.localStorage.setItem('aotd:favorites', '{not json');
    favoritesStore.reset();
    expect(getFavorites()).toEqual({});
  });

  it('turns notifications off and on for a single anime', () => {
    toggleFavorite({ id: 1, title: 'Frieren' });
    toggleFavorite({ id: 2, title: 'Dandadan' });
    expect(getNotifyIds().sort()).toEqual([1, 2]);

    setFavoriteNotify(2, false);
    expect(getNotifyIds()).toEqual([1]);
    expect(getFavoriteIds().sort()).toEqual([1, 2]);

    setFavoriteNotify(2, true);
    expect(getNotifyIds().sort()).toEqual([1, 2]);
  });
});
