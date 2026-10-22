import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { clearQueryCache, useAnilistQuery } from './useAnilistQuery';
import { mockAnilist } from '../test/anilistMock';

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
    expect(result.current).toEqual({ data: undefined, error: null, loading: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not request anything while skipped', () => {
    const fetchMock = mockAnilist(() => ({ data: { Media: { id: 1 } } }));
    const { result } = renderHook(() => useTestQuery({ id: 1, skip: true }));

    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
