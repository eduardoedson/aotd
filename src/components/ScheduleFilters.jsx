import { useId } from 'react';
import { GENRES } from '../services/globals';
import {
  disableNotifications,
  enableNotifications,
  useNotificationStatus,
} from '../services/notifications';

function NotificationToggle() {
  const { supported, permission, enabled } = useNotificationStatus();

  if (!supported) return null;

  if (permission === 'denied') {
    return (
      <span
        className='filters-hint'
        title='Allow notifications for this site in your browser settings'
      >
        Notifications blocked
      </span>
    );
  }

  return (
    <button
      type='button'
      className={`filters-chip${enabled ? ' is-active' : ''}`}
      aria-pressed={enabled}
      onClick={() => (enabled ? disableNotifications() : enableNotifications())}
      title='Get a notification when an episode of a favorite is released (while AOTD is open)'
    >
      <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
        <path d='M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2z' />
      </svg>
      {enabled ? 'Notifications on' : 'Notify me'}
    </button>
  );
}

function ScheduleFilters({ filters }) {
  const searchId = useId();
  const genreId = useId();

  return (
    <div className='filters' role='search'>
      <div className='filters-field filters-field-search'>
        <label className='visually-hidden' htmlFor={searchId}>
          Search titles
        </label>
        <svg
          className='filters-search-icon'
          viewBox='0 0 24 24'
          aria-hidden='true'
          focusable='false'
        >
          <path d='M10 2a8 8 0 0 1 6.32 12.9l5.39 5.4-1.41 1.4-5.4-5.39A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z' />
        </svg>
        <input
          id={searchId}
          className='filters-input'
          type='search'
          placeholder='Search titles'
          autoComplete='off'
          value={filters.query}
          onChange={(event) => filters.setQuery(event.target.value)}
        />
      </div>
      <div className='filters-field'>
        <label className='visually-hidden' htmlFor={genreId}>
          Genre
        </label>
        <select
          id={genreId}
          className='filters-select'
          value={filters.genre}
          onChange={(event) => filters.setGenre(event.target.value)}
        >
          <option value=''>All genres</option>
          {GENRES.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
      </div>
      <button
        type='button'
        className={`filters-chip${filters.favoritesOnly ? ' is-active' : ''}`}
        aria-pressed={filters.favoritesOnly}
        onClick={() => filters.setFavoritesOnly(!filters.favoritesOnly)}
      >
        <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
          <path d='M12 20.5s-7.4-4.5-9.6-9.1C.8 8.1 2.6 4.4 6.2 4c2-.2 3.8.9 4.8 2.5.4.6 1.6.6 2 0 1-1.6 2.8-2.7 4.8-2.5 3.6.4 5.4 4.1 3.8 7.4-2.2 4.6-9.6 9.1-9.6 9.1z' />
        </svg>
        Only my favorites
      </button>
      <NotificationToggle />
      {filters.active ? (
        <button type='button' className='filters-clear' onClick={filters.clear}>
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

export default ScheduleFilters;
