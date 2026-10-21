import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import CardHome from './CardHome';
import Loading from './Loading';
import Error from './Error';
import { useDaySchedule } from '../services/schedule';
import { useFavorites } from '../services/favorites';
import { matchesFilters } from '../services/filters';
import { useInfiniteScroll } from '../services/useInfiniteScroll';
import { formatLongDate } from '../services/globals';

const NO_FILTERS = { query: '', genre: '', favoritesOnly: false, active: false };

function Day({ date, filters = NO_FILTERS }) {
  const { search } = useLocation();
  const { items, error, hasNextPage, loading, initialLoading, loadMore, retry } =
    useDaySchedule(date);
  const { isFavorite } = useFavorites();

  const { query, genre, favoritesOnly } = filters;
  const visibleItems = useMemo(
    () => items.filter((item) => matchesFilters(item, { query, genre, favoritesOnly }, isFavorite)),
    [items, query, genre, favoritesOnly, isFavorite],
  );

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    enabled: hasNextPage && !loading && !error,
    version: items.length,
  });

  if (initialLoading) return <Loading label='Loading schedule' />;

  if (error && items.length === 0) {
    return (
      <Error msg={error.message}>
        <button type='button' className='day-retry' onClick={retry}>
          Try again
        </button>
      </Error>
    );
  }

  const finished = !hasNextPage && !loading;
  const countLabel = `${items.length}${hasNextPage ? '+' : ''} episode${items.length === 1 ? '' : 's'}`;
  const summary = filters.active
    ? `${visibleItems.length} of ${countLabel} match your filters`
    : `${countLabel} airing on this day`;

  return (
    <section className='day' aria-label={`Episodes airing on ${formatLongDate(date)}`}>
      <p className='day-summary' aria-live='polite'>
        {summary}
      </p>

      {visibleItems.length > 0 ? (
        <div className='day-container'>
          {visibleItems.map((item) => (
            <CardHome key={item.id} item={item} date={date} search={search} />
          ))}
        </div>
      ) : null}

      {finished && visibleItems.length === 0 ? (
        <p className='day-empty'>
          {filters.active
            ? 'No episodes match your filters on this day.'
            : 'No episodes are scheduled for this day.'}
        </p>
      ) : null}

      {loading ? <Loading label='Loading more episodes' /> : null}

      {error ? (
        <div className='day-inline-error' role='alert'>
          <span>Could not load more episodes.</span>
          <button type='button' className='day-retry' onClick={retry}>
            Try again
          </button>
        </div>
      ) : null}

      {hasNextPage && !loading && !error ? (
        <div ref={sentinelRef} className='day-sentinel'>
          <button type='button' className='day-load-more' onClick={loadMore}>
            Load more episodes
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default Day;
