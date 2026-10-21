import { Link } from 'react-router-dom';
import Timer from './Timer';
import UpcomingOnly from './UpcomingOnly';
import { MIN_SEARCH_LENGTH, useTitleSearch } from '../services/search';
import {
  formatAiringTime,
  formatLongDate,
  getSafeExternalUrl,
  humanizeEnum,
  toIsoDateInZone,
} from '../services/globals';
import { accentFor } from '../services/color';
import { describeAnilistError } from '../services/anilist';
import { useTheme } from '../services/preferences';
import { prefetchIntent } from '../services/prefetch';

const FORMATS = { TV: 'TV', TV_SHORT: 'TV Short', MOVIE: 'Movie', OVA: 'OVA', ONA: 'ONA' };

// Matches from every day, shown above the schedule while a title is searched.
function TitleSearchResults({ query, date, timeZone }) {
  const theme = useTheme();
  const { enabled, loading, pending, error, results, search } = useTitleSearch(query);

  if (query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH) return null;
  if (!enabled && !pending) return null;

  return (
    <section
      className='title-search'
      aria-label='Search results from every day'
      aria-busy={loading || pending}
    >
      <header className='title-search-header'>
        <h2>All anime matching “{search || query.trim()}”</h2>
        <span>Any day, not only {formatLongDate(date)}</span>
      </header>

      {error ? (
        <p className='title-search-empty'>The search failed. {describeAnilistError(error)}</p>
      ) : null}
      {!error && !loading && !pending && results.length === 0 ? (
        <p className='title-search-empty'>No anime found with that title.</p>
      ) : null}

      <ul className={`title-search-list${loading || pending ? ' is-loading' : ''}`}>
        {results.map((media) => {
          const title = media.title?.userPreferred ?? 'Untitled';
          const next = media.nextAiringEpisode;
          const nextDay = next ? toIsoDateInZone(new Date(next.airingAt * 1000), timeZone) : null;
          const image = getSafeExternalUrl(media.coverImage?.large ?? media.coverImage?.medium);
          const meta = [
            FORMATS[media.format] ?? (media.format ? humanizeEnum(media.format) : null),
            media.seasonYear,
            media.status ? humanizeEnum(media.status) : null,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <li
              key={media.id}
              className='title-search-item'
              style={{ '--card-accent': accentFor(media.coverImage?.color, theme) }}
            >
              <Link
                className='title-search-link'
                to={`/${nextDay ?? date}/${media.id}`}
                {...prefetchIntent(media.id)}
              >
                {image ? (
                  <img src={image} alt='' loading='lazy' decoding='async' />
                ) : (
                  <span className='title-search-placeholder' aria-hidden='true' />
                )}
                <span className='title-search-text'>
                  <strong>{title}</strong>
                  {meta ? <small>{meta}</small> : null}
                  {next ? (
                    <span className='title-search-next'>
                      Ep {next.episode} · {formatLongDate(nextDay)}{' '}
                      {formatAiringTime(next.airingAt, timeZone)}
                      <UpcomingOnly airingAt={next.airingAt}>
                        {' '}
                        · in <Timer airingAt={next.airingAt} />
                      </UpcomingOnly>
                    </span>
                  ) : (
                    <span className='title-search-next is-muted'>No upcoming episode</span>
                  )}
                </span>
              </Link>
              {nextDay && nextDay !== date ? (
                <Link className='title-search-day' to={`/${nextDay}`}>
                  Go to day
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default TitleSearchResults;
