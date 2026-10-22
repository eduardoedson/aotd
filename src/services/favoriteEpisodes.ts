import { useMemo } from 'react';
import { useAnilistQueries } from './useAnilistQuery';
import { FAVORITE_EPISODES_QUERY, type FavoriteEpisodesResponse } from './queries';
import { chunk, MEDIA_BATCH_SIZE } from '../../shared/releaseTracker.js';

type FavoriteMedia = NonNullable<FavoriteEpisodesResponse['Page']>['media'][number];

// Next episode of every favorite. AniList answers at most 50 media per request, so
// longer libraries are queried in batches and merged in one list.
export function useFavoriteEpisodes(ids: number[]) {
  const variablesList = useMemo(
    () => chunk(ids).map((batch) => ({ ids: batch, perPage: MEDIA_BATCH_SIZE })),
    [ids],
  );
  const { data, error, loading, staleSince } = useAnilistQueries<FavoriteEpisodesResponse>(
    FAVORITE_EPISODES_QUERY,
    variablesList,
    { skip: ids.length === 0 },
  );
  const media = useMemo<FavoriteMedia[]>(
    () => (data ?? []).flatMap((page) => page?.Page?.media ?? []),
    [data],
  );
  return { media, error, loading, staleSince };
}
