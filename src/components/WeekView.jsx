import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import FavoriteButton from './FavoriteButton';
import Error from './Error';
import { useSchedule } from '../services/schedule';
import { useFavorites } from '../services/favorites';
import { matchesFilters } from '../services/filters';
import {
  formatAiringTime,
  formatShortDate,
  formatWeekDayShort,
  getRange,
  getSafeExternalUrl,
  getToday,
  getWeekDays,
  getWeekStart,
  toIsoDateInZone,
} from '../services/globals';

const NO_FILTERS = { query: '', genre: '', favoritesOnly: false, active: false };

// Seven columns, one per day, loaded with a single paginated range query.
function WeekView({ date, timeZone = 'utc', filters = NO_FILTERS }) {
  const { search } = useLocation();
  const days = getWeekDays(date);
  const range = getRange(getWeekStart(date), 7, timeZone);
  const { items, error, loading, retry } = useSchedule(range, { loadAll: true });
  const { isFavorite } = useFavorites();
  const today = getToday(timeZone);
  const daySearch = useMemo(() => {
    const params = new URLSearchParams(search);
    params.delete('view');
    const value = params.toString();
    return value ? `?${value}` : '';
  }, [search]);

  const { query, genre, favoritesOnly } = filters;
  const byDay = useMemo(() => {
    const groups = Object.fromEntries(days.map((day) => [day, []]));
    items
      .filter((item) => matchesFilters(item, { query, genre, favoritesOnly }, isFavorite))
      .forEach((item) => {
        const day = toIsoDateInZone(new Date(item.airingAt * 1000), timeZone);
        groups[day]?.push(item);
      });
    return groups;
    // days is derived from date, which is part of the component key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, genre, favoritesOnly, isFavorite, timeZone]);

  if (error && items.length === 0) {
    return (
      <Error msg={error.message}>
        <button type='button' className='day-retry' onClick={retry}>
          Try again
        </button>
      </Error>
    );
  }

  return (
    <section className='week' aria-busy={loading} aria-label='Weekly schedule'>
      <p className='day-summary' aria-live='polite'>
        {loading
          ? `Loading the week… ${items.length} episodes so far`
          : `${items.length} episodes this week`}
      </p>
      <div className='week-grid'>
        {days.map((day) => (
          <div key={day} className={`week-column${day === today ? ' is-today' : ''}`}>
            <Link className='week-column-header' to={`/${day}${daySearch}`}>
              <span>{formatWeekDayShort(day)}</span>
              <strong>{formatShortDate(day)}</strong>
            </Link>
            <ul className='week-list'>
              {byDay[day].map((item) => {
                const title = item.media.title?.userPreferred ?? 'Untitled';
                const image = getSafeExternalUrl(item.media.coverImage?.extraLarge);
                return (
                  <li
                    key={item.id}
                    className='week-item'
                    style={{ '--card-accent': item.media.coverImage?.color || '#ff3d8d' }}
                  >
                    <time
                      className='week-item-time'
                      dateTime={new Date(item.airingAt * 1000).toISOString()}
                    >
                      {formatAiringTime(item.airingAt, timeZone)}
                    </time>
                    <Link className='week-item-link' to={`/${day}/${item.media.id}${daySearch}`}>
                      <span className='week-item-title'>{title}</span>
                      <span className='week-item-episode'>Ep {item.episode}</span>
                    </Link>
                    <FavoriteButton
                      className='week-item-favorite'
                      id={item.media.id}
                      title={title}
                      image={image}
                    />
                  </li>
                );
              })}
              {!loading && byDay[day].length === 0 ? (
                <li className='week-empty'>Nothing here</li>
              ) : null}
            </ul>
          </div>
        ))}
      </div>
      {error ? (
        <div className='day-inline-error' role='alert'>
          <span>Part of the week could not be loaded.</span>
          <button type='button' className='day-retry' onClick={retry}>
            Try again
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default WeekView;
