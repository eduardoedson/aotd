import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cachedRequest,
  clearQueryCache,
  getQueryCacheSize,
  MAX_MEMORY_ENTRIES,
  useAnilistQuery,
} from './useAnilistQuery';
import { graphQLError, mockAnilist } from '../test/anilistMock';
import { writePersistent } from './persistentCache';

const QUERY = 'query HookTest($id: Int) { Media(id: $id) { id } }';

interface Result {
  Media: { id: number };
}

interface Props {
  id: number;
  skip?: boolean;
}

const useTestQuery = ({ id, skip = false }: Props) =>
  useAnilistQuery<Result>(QUERY, { id }, { skip });

afterEach(() => clearQueryCache());

describe('useAnilistQuery', () => {
  it('loads data and never shows the previous result for new variables', async () => {
    mockAnilist(({ variables }: { variables: { id: number } }) => ({
      data: { Media: { id: variables.id } },
    }));
    const { result, rerender } = renderHook((props: Props) => useTestQuery(props), {
      initialProps: { id: 1 } as Props,
    });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual({ Media: { id: 1 } }));

    rerender({ id: 2 });
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual({ Media: { id: 2 } }));

    // Going back is instant thanks to the shared cache.
    rerender({ id: 1 });
    expect(result.current.data).toEqual({ Media: { id: 1 } });
    expect(result.current.loading).toBe(false);
  });

  it('respects skip when it changes from false to true', async () => {
    const fetchMock = mockAnilist(() => ({ data: { Media: { id: 1 } } }));
    const { result, rerender } = renderHook((props: Props) => useTestQuery(props), {
      initialProps: { id: 1, skip: false } as Props,
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ id: 1, skip: true });
    expect(result.current).toEqual({
      data: undefined,
      error: null,
      loading: false,
      staleSince: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not request anything while skipped', () => {
    const fetchMock = mockAnilist(() => ({ data: { Media: { id: 1 } } }));
    const { result } = renderHook(() => useTestQuery({ id: 1, skip: true }));

    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the memory cache bounded', async () => {
    mockAnilist(({ variables }: { variables: { id: number } }) => ({
      data: { Media: { id: variables.id } },
    }));
    const requests = Array.from({ length: MAX_MEMORY_ENTRIES + 20 }, (_, id) =>
      cachedRequest<Result>(QUERY, { id }),
    );
    await Promise.all(requests);
    expect(getQueryCacheSize()).toBeLessThanOrEqual(MAX_MEMORY_ENTRIES);
  });

  it('falls back to saved data and reports when it was saved', async () => {
    const savedAt = Date.now() - 2 * 60 * 60 * 1000;
    writePersistent('HookTest:{"id":7}', { Media: { id: 7 } }, savedAt);
    mockAnilist(() => graphQLError(400, 'Service down'));
    const { result } = renderHook(() => useTestQuery({ id: 7 }));

    await waitFor(() => expect(result.current.data).toEqual({ Media: { id: 7 } }));
    expect(result.current.staleSince).toBe(savedAt);
    expect(result.current.error).toBeNull();
  });
});
