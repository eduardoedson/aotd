import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useWatched, watchedStore } from './watched';

afterEach(() => {
  window.localStorage.clear();
  watchedStore.reset();
});

describe('watched progress', () => {
  it('marks progress through an episode and can undo it', () => {
    const { result } = renderHook(() => useWatched());
    act(() => result.current.toggleWatched(10, 4));
    expect(result.current.watchedThrough(10)).toBe(4);
    expect(result.current.isWatched(10, 3)).toBe(true);
    act(() => result.current.toggleWatched(10, 4));
    expect(result.current.watchedThrough(10)).toBe(3);
  });
});
