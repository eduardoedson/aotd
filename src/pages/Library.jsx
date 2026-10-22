import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FavoriteButton from '../components/FavoriteButton';
import NotifyToggle from '../components/NotifyToggle';
import AddToCalendarButton from '../components/AddToCalendarButton';
import Timer from '../components/Timer';
import UpcomingOnly from '../components/UpcomingOnly';
import { useFavorites } from '../services/favorites';
import { clearHistory, useHistory } from '../services/history';
import { useWatched } from '../services/watched';
import {
  formatAiringTime,
  formatLongDate,
  getSafeExternalUrl,
  getToday,
  toIsoDateInZone,
} from '../services/globals';
import { useTimeZone } from '../services/timezone';
import { useDocumentTitle } from '../services/useDocumentTitle';
import { useFavoriteEpisodes } from '../services/favoriteEpisodes';
import StaleNotice from '../components/StaleNotice';
import { useNow } from '../services/useNow';

const WEEK_SECONDS = 7 * 24 * 60 * 60;

const SORTS = {
  added: 'Recently added',
  next: 'Next episode',
  title: 'A to Z',
};

function Stat({ value, label }) {
  return (
    <div className='library-stat'>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ title, text, today }) {
  return (
    <div className='library-empty'>
      <strong>{title}</strong>
      <p>{text}</p>
      <Link className='library-cta' to={`/${today}`}>
        Browse today&apos;s schedule
      </Link>
    </div>
  );
}

// Live count of favorites with an episode in the next seven days.
function useAiringThisWeek(nextById) {
  const now = useNow() / 1000;
  return Object.values(nextById).filter(
    (next) => next && next.airingAt > now && next.airingAt - now <= WEEK_SECONDS,
  ).length;
}

function Library() {
  useDocumentTitle('My library');
  const { favorites } = useFavorites();
  const history = useHistory();
  const { watched } = useWatched();
  const timeZone = useTimeZone();
  const today = getToday(timeZone);
  const [sort, setSort] = useState('added');

  const favoriteList = useMemo(() => Object.values(favorites), [favorites]);
  const ids = useMemo(() => favoriteList.map((item) => Number(item.id)), [favoriteList]);
  const { media, loading, staleSince } = useFavoriteEpisodes(ids);

  const nextById = useMemo(
    () => Object.fromEntries(media.map((item) => [item.id, item.nextAiringEpisode])),
    [media],
  );
  const airingThisWeek = useAiringThisWeek(nextById);

  const sortedFavorites = useMemo(() => {
    const list = [...favoriteList];
    if (sort === 'title') return list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'next') {
      const key = (item) => nextById[item.id]?.airingAt ?? Number.MAX_SAFE_INTEGER;
      return list.sort((a, b) => key(a) - key(b));
    }
    return list.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
  }, [favoriteList, sort, nextById]);

  const upNext = useMemo(
    () =>
      favoriteList
        .filter((item) => nextById[item.id])
        .sort((a, b) => nextById[a.id].airingAt - nextById[b.id].airingAt)
        .slice(0, 6),
    [favoriteList, nextById],
  );

  return (
    <div className='library-page'>
      <header className='library-header'>
        <Link className='library-back' to={`/${today}`}>
          <span aria-hidden='true'>←</span> Back to schedule
        </Link>
        <span className='library-eyebrow'>Your collection</span>
        <h1>My library</h1>
        <p>
          Favorites, watching progress and recently viewed titles, saved privately in this browser.
        </p>
        <div className='library-stats'>
          <Stat
            value={favoriteList.length}
            label={favoriteList.length === 1 ? 'Favorite' : 'Favorites'}
          />
          <Stat value={loading ? '…' : airingThisWeek} label='Airing this week' />
          <Stat value={history.length} label='Recently viewed' />
        </div>
        <StaleNotice since={staleSince} />
      </header>

      {upNext.length > 0 ? (
        <section className='library-section' aria-labelledby='library-up-next'>
          <div className='library-section-header'>
            <h2 id='library-up-next'>Up next</h2>
          </div>
          <ul className='library-upnext'>
            {upNext.map((item) => {
              const next = nextById[item.id];
              const day = toIsoDateInZone(new Date(next.airingAt * 1000), timeZone);
              return (
                <li key={item.id} className='library-upnext-item'>
                  <Link to={`/${day}/${item.id}`} className='library-upnext-link'>
                    {getSafeExternalUrl(item.image) ? (
                      <img
                        src={getSafeExternalUrl(item.image)}
                        alt=''
                        loading='lazy'
                        decoding='async'
                      />
                    ) : (
                      <span className='library-placeholder' aria-hidden='true' />
                    )}
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        Episode {next.episode} · {formatLongDate(day)} at{' '}
                        {formatAiringTime(next.airingAt, timeZone)}
                      </small>
                      <UpcomingOnly airingAt={next.airingAt}>
                        <em>
                          in <Timer airingAt={next.airingAt} />
                        </em>
                      </UpcomingOnly>
                    </span>
                  </Link>
                  <div className='library-upnext-actions'>
                    <AddToCalendarButton
                      mediaId={item.id}
                      title={item.title}
                      episode={next.episode}
                      airingAt={next.airingAt}
                    />
                    <NotifyToggle id={item.id} title={item.title} compact />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className='library-section' aria-labelledby='library-favorites'>
        <div className='library-section-header'>
          <h2 id='library-favorites'>
            Favorites <span>{favoriteList.length}</span>
          </h2>
          {favoriteList.length > 1 ? (
            <label className='library-sort'>
              <span className='visually-hidden'>Sort favorites</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                {Object.entries(SORTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {sortedFavorites.length ? (
          <ul className='library-grid'>
            {sortedFavorites.map((item) => {
              const next = nextById[item.id];
              const progress = watched[item.id];
              const day = next ? toIsoDateInZone(new Date(next.airingAt * 1000), timeZone) : today;
              const image = getSafeExternalUrl(item.image);
              return (
                <li key={item.id} className='library-poster'>
                  <Link to={`/${day}/${item.id}`} className='library-poster-link'>
                    {image ? (
                      <img src={image} alt='' loading='lazy' decoding='async' />
                    ) : (
                      <span className='library-placeholder' aria-hidden='true' />
                    )}
                    <span className='library-poster-text'>
                      <strong>{item.title}</strong>
                      <small>
                        {next
                          ? `Ep ${next.episode} on ${formatLongDate(day).split(',')[0]}`
                          : loading
                            ? 'Checking schedule…'
                            : 'No upcoming episode'}
                      </small>
                      {progress ? <small>Watched through episode {progress}</small> : null}
                    </span>
                  </Link>
                  <div className='library-poster-actions'>
                    <NotifyToggle id={item.id} title={item.title} compact />
                    <FavoriteButton id={item.id} title={item.title} image={item.image} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            today={today}
            title='No favorites yet'
            text='Tap the heart on any anime to keep it here and get notified about new episodes.'
          />
        )}
      </section>

      <section className='library-section' aria-labelledby='library-history'>
        <div className='library-section-header'>
          <h2 id='library-history'>
            Recently viewed <span>{history.length}</span>
          </h2>
          {history.length ? (
            <button type='button' className='library-clear' onClick={clearHistory}>
              Clear history
            </button>
          ) : null}
        </div>
        {history.length ? (
          <ul className='library-history'>
            {history.map((item) => (
              <li key={item.id}>
                <Link to={`/${item.date}/${item.id}`} className='library-history-link'>
                  {getSafeExternalUrl(item.image) ? (
                    <img
                      src={getSafeExternalUrl(item.image)}
                      alt=''
                      loading='lazy'
                      decoding='async'
                    />
                  ) : (
                    <span className='library-placeholder' aria-hidden='true' />
                  )}
                  <strong>{item.title}</strong>
                  <small>Viewed {new Date(item.viewedAt).toLocaleDateString()}</small>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            today={today}
            title='Nothing viewed yet'
            text='The anime you open will appear here, so you can find them again quickly.'
          />
        )}
      </section>
    </div>
  );
}

export default Library;
