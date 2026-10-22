import { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import Tag from '../components/Tag';
import StaleNotice from '../components/StaleNotice';
import MiniCard from '../components/MiniCard';
import StarRating from '../components/StarRating';
import FavoriteButton from '../components/FavoriteButton';
import AddToCalendarButton from '../components/AddToCalendarButton';
import ShareButton from '../components/ShareButton';
import DetailSkeleton from '../components/DetailSkeleton';
import Timer from '../components/Timer';
import UpcomingOnly from '../components/UpcomingOnly';
import WatchButton from '../components/WatchButton';
import NotifyToggle from '../components/NotifyToggle';
import Error from './Error';
import {
  formatAiringTime,
  formatFuzzyDate,
  formatLongDate,
  getSafeExternalUrl,
  humanizeEnum,
  isValidDate,
  toIsoDateInZone,
} from '../services/globals';
import { describeAnilistError, getErrorStatus } from '../services/anilist';
import { useAnilistQuery } from '../services/useAnilistQuery';
import { DETAIL_QUERY, EPISODE_QUERY } from '../services/queries';
import { accentFor, textOn } from '../services/color';
import { useTheme } from '../services/preferences';
import { scheduleSearch, useNeighbours } from '../services/navigation';
import { prefetchDetail } from '../services/prefetch';
import { useTimeZone } from '../services/timezone';
import { useDocumentTitle } from '../services/useDocumentTitle';
import { addHistory } from '../services/history';

function Category({ title, inline = false, children }) {
  return (
    <div className='detail-category'>
      <span className='detail-category-title'>{title}</span>
      <span
        className={inline ? 'detail-category-description-inline' : 'detail-category-description'}
      >
        {children}
      </span>
    </div>
  );
}

const FORMATS = {
  TV: 'TV',
  TV_SHORT: 'TV Short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
  MANGA: 'Manga',
  NOVEL: 'Light Novel',
  ONE_SHOT: 'One Shot',
};

const COUNTRIES = { JP: 'Japan', KR: 'South Korea', CN: 'China', TW: 'Taiwan' };

const numberFormat = new Intl.NumberFormat('en');

const formatLabel = (value) => (value ? (FORMATS[value] ?? humanizeEnum(value)) : null);

const rankingLabel = (ranking) => {
  const context = ranking.context.charAt(0).toUpperCase() + ranking.context.slice(1);
  if (ranking.allTime) return `#${ranking.rank} ${context}`;
  const period = [ranking.season ? humanizeEnum(ranking.season) : null, ranking.year]
    .filter(Boolean)
    .join(' ');
  return `#${ranking.rank} ${context}${period ? ` (${period})` : ''}`;
};

const isTypingTarget = (target) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// Previous and next anime of the schedule list the visitor came from.
function NeighbourNav({ mediaId }) {
  const navigate = useNavigate();
  const { previous, next, search } = useNeighbours(mediaId);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;
      const target =
        event.key === 'ArrowLeft' ? previous : event.key === 'ArrowRight' ? next : null;
      if (!target) return;
      event.preventDefault();
      navigate(`/${target.date}/${target.mediaId}${search}`);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previous, next, search, navigate]);

  useEffect(() => {
    if (next) prefetchDetail(next.mediaId);
  }, [next]);

  if (!previous && !next) return null;

  return (
    <nav className='detail-neighbours' aria-label='Previous and next anime'>
      {previous ? (
        <Link
          className='detail-neighbour is-previous'
          to={`/${previous.date}/${previous.mediaId}${search}`}
        >
          <span aria-hidden='true'>←</span>
          <span>
            <small>Previous</small>
            <strong>{previous.title}</strong>
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className='detail-neighbour is-next' to={`/${next.date}/${next.mediaId}${search}`}>
          <span>
            <small>Next</small>
            <strong>{next.title}</strong>
          </span>
          <span aria-hidden='true'>→</span>
        </Link>
      ) : null}
    </nav>
  );
}

// Banner for links shared for one specific episode (?ep=N).
function EpisodeBanner({ mediaId, episode, title }) {
  const timeZone = useTimeZone();
  const variables = useMemo(() => ({ mediaId, episode }), [mediaId, episode]);
  const { data } = useAnilistQuery(EPISODE_QUERY, variables);
  const airing = data?.AiringSchedule;
  if (!airing) return null;

  const day = toIsoDateInZone(new Date(airing.airingAt * 1000), timeZone);
  return (
    <div className='detail-episode-banner' role='note'>
      <div>
        <span className='detail-category-title'>Shared episode</span>
        <strong>
          Episode {airing.episode}, {formatLongDate(day)} at{' '}
          {formatAiringTime(airing.airingAt, timeZone)}
        </strong>
      </div>
      <span className='detail-episode-status'>
        <Timer airingAt={airing.airingAt} />
      </span>
      <ShareButton title={`${title} episode ${airing.episode}`} label='Share episode' />
    </div>
  );
}

function DetailView({ info, date, search, episodeParam }) {
  const title = info.title?.userPreferred ?? 'Untitled';
  const isAnime = info.type === 'ANIME';
  const coverImage = getSafeExternalUrl(info.coverImage?.extraLarge);
  const mediumCover = getSafeExternalUrl(info.coverImage?.medium);
  const largeCover = getSafeExternalUrl(info.coverImage?.large);
  const siteUrl = getSafeExternalUrl(info.siteUrl);
  const description = useMemo(() => DOMPurify.sanitize(info.description ?? ''), [info.description]);

  const alternativeTitles = ['romaji', 'english', 'native']
    .map((key) => info.title?.[key])
    .filter((value, index, list) => value && value !== title && list.indexOf(value) === index);
  const safeLinks = (info.externalLinks ?? [])
    .map((link) => ({ ...link, url: getSafeExternalUrl(link.url) }))
    .filter((link) => link.url);
  const trailerId =
    info.trailer?.site === 'youtube' && /^[\w-]+$/.test(info.trailer.id ?? '')
      ? info.trailer.id
      : null;
  const next = info.nextAiringEpisode;
  const count = isAnime ? info.episodes : info.chapters;
  const theme = useTheme();
  const accent = accentFor(info.coverImage?.color, theme);
  const season = [info.season ? humanizeEnum(info.season) : null, info.seasonYear]
    .filter(Boolean)
    .join(' ');
  const rankings = (info.rankings ?? []).slice(0, 3);
  const relations = (info.relations?.edges ?? []).filter((edge) => edge.node?.id).slice(0, 12);
  const backdrop = largeCover ?? coverImage;

  return (
    <div
      className='detail-content'
      style={{ '--detail-accent': accent, '--detail-on-accent': textOn(accent) }}
    >
      {backdrop ? (
        <div
          className='detail-backdrop'
          aria-hidden='true'
          style={{ backgroundImage: `url(${JSON.stringify(backdrop)})` }}
        />
      ) : null}
      <NeighbourNav mediaId={info.id} />
      {episodeParam ? (
        <EpisodeBanner mediaId={info.id} episode={episodeParam} title={title} />
      ) : null}
      {/* On wide screens the two columns flow independently; on small screens the
          columns use display: contents and the blocks are reordered with CSS only. */}
      <div className='detail-layout'>
        <div className='detail-column detail-column-left'>
          <div className='detail-block detail-block-cover'>
            {coverImage ? (
              <img
                className='detail-cover'
                src={coverImage}
                srcSet={[
                  mediumCover && `${mediumCover} 230w`,
                  largeCover && `${largeCover} 460w`,
                  `${coverImage} 920w`,
                ]
                  .filter(Boolean)
                  .join(', ')}
                sizes='(max-width: 900px) 340px, 320px'
                alt={title}
              />
            ) : null}
            {info.averageScore ? <StarRating score={info.averageScore} /> : null}
            <div className='detail-actions'>
              <FavoriteButton
                className='detail-favorite'
                id={info.id}
                title={title}
                image={coverImage}
                showLabel
              />
              <ShareButton title={episodeParam ? `${title} episode ${episodeParam}` : title} />
              <NotifyToggle id={info.id} title={title} />
              {isAnime ? (
                <WatchButton
                  mediaId={info.id}
                  episode={
                    info.nextAiringEpisode
                      ? Math.max(1, info.nextAiringEpisode.episode - 1)
                      : info.episodes || 1
                  }
                  showLabel
                />
              ) : null}
            </div>
          </div>

          <div className='detail-block detail-block-meta'>
            {alternativeTitles.length > 0 ? (
              <Category title='Alternative Titles'>
                {alternativeTitles.map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </Category>
            ) : null}
            {info.synonyms?.length > 0 ? (
              <Category title='Synonyms'>
                {info.synonyms.map((synonym) => (
                  <span key={synonym}>{synonym}</span>
                ))}
              </Category>
            ) : null}
            {info.genres?.length > 0 ? (
              <Category title='Genres' inline>
                {info.genres.map((genre) => (
                  <Tag key={genre} text={genre} />
                ))}
              </Category>
            ) : null}
            {info.tags?.length > 0 ? (
              <Category title='Tags' inline>
                {info.tags.map((tag) => (
                  <Tag key={tag.id} text={tag.name} />
                ))}
              </Category>
            ) : null}
            {info.studios?.nodes?.length > 0 ? (
              <Category title='Studios'>
                {info.studios.nodes.map((studio) => (
                  <span key={studio.id}>{studio.name}</span>
                ))}
              </Category>
            ) : null}
            {rankings.length > 0 ? (
              <Category title='Rankings'>
                {rankings.map((ranking) => (
                  <span key={ranking.id}>{rankingLabel(ranking)}</span>
                ))}
              </Category>
            ) : null}
            {info.hashtag ? <Category title='Hashtag'>{info.hashtag}</Category> : null}
            {safeLinks.length > 0 ? (
              <Category title='Useful Links'>
                {safeLinks.map((link) => (
                  <a key={link.id} href={link.url} target='_blank' rel='noopener noreferrer'>
                    {link.site}
                  </a>
                ))}
              </Category>
            ) : null}
          </div>
        </div>

        <div className='detail-column detail-column-right'>
          <header className='detail-block detail-block-header'>
            <Link className='detail-back' to={`/${date}${search}`}>
              <span aria-hidden='true'>←</span> Back to schedule
            </Link>
            <div className='detail-kicker'>{isAnime ? 'Anime details' : 'Manga details'}</div>
            <h1 className='detail-title'>{title}</h1>
            <div className='detail-description' dangerouslySetInnerHTML={{ __html: description }} />
          </header>

          <div className='detail-block detail-block-facts'>
            <div className='detail-category-line'>
              {info.format ? <Category title='Format'>{formatLabel(info.format)}</Category> : null}
              {info.status ? <Category title='Status'>{humanizeEnum(info.status)}</Category> : null}
              {season ? <Category title='Season'>{season}</Category> : null}
              <Category title={isAnime ? 'Episodes' : 'Chapters'}>{count || 'Unknown'}</Category>
              {isAnime && info.duration ? (
                <Category title='Duration'>{info.duration} min per episode</Category>
              ) : null}
              {info.source ? <Category title='Source'>{humanizeEnum(info.source)}</Category> : null}
              {info.countryOfOrigin ? (
                <Category title='Country'>
                  {COUNTRIES[info.countryOfOrigin] ?? info.countryOfOrigin}
                </Category>
              ) : null}
              <Category title='Start Date'>{formatFuzzyDate(info.startDate ?? undefined)}</Category>
              <Category title='End Date'>{formatFuzzyDate(info.endDate ?? undefined)}</Category>
              {info.meanScore ? <Category title='Mean Score'>{info.meanScore}%</Category> : null}
              {info.popularity ? (
                <Category title='Popularity'>{numberFormat.format(info.popularity)} users</Category>
              ) : null}
              {info.favourites ? (
                <Category title='Favourites'>{numberFormat.format(info.favourites)}</Category>
              ) : null}
            </div>
          </div>

          <div className='detail-block detail-block-media'>
            {next ? (
              <UpcomingOnly airingAt={next.airingAt}>
                <div className='detail-next'>
                  <div className='detail-next-info'>
                    <span className='detail-category-title'>Next episode</span>
                    <strong>
                      Episode {next.episode} in <Timer airingAt={next.airingAt} />
                    </strong>
                  </div>
                  <AddToCalendarButton
                    className='detail-next-button'
                    mediaId={info.id}
                    title={title}
                    episode={next.episode}
                    airingAt={next.airingAt}
                    duration={info.duration}
                    url={siteUrl}
                    showLabel
                  />
                </div>
              </UpcomingOnly>
            ) : null}
            {trailerId ? (
              <div className='detail-trailer'>
                <iframe
                  className='detail-trailer-iframe'
                  title={`${title} trailer`}
                  src={`https://www.youtube-nocookie.com/embed/${trailerId}`}
                  loading='lazy'
                  referrerPolicy='strict-origin-when-cross-origin'
                  allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen'
                />
              </div>
            ) : null}
            {relations.length > 0 ? (
              <div className='detail-relations'>
                <span className='detail-category-title'>Related</span>
                <ul className='detail-relations-list'>
                  {relations.map((edge) => (
                    <li key={edge.id}>
                      <Link to={`/${date}/${edge.node.id}${search}`} className='detail-relation'>
                        {getSafeExternalUrl(edge.node.coverImage?.medium) ? (
                          <img
                            src={getSafeExternalUrl(edge.node.coverImage?.medium)}
                            alt=''
                            loading='lazy'
                            decoding='async'
                          />
                        ) : (
                          <span className='detail-relation-placeholder' aria-hidden='true' />
                        )}
                        <span>
                          <small>
                            {[
                              edge.relationType && humanizeEnum(edge.relationType),
                              formatLabel(edge.node.format),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </small>
                          <strong>{edge.node.title?.userPreferred ?? 'Untitled'}</strong>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {info.characters?.nodes?.length > 0 ? (
              <div className='detail-characters'>
                <span className='detail-category-title'>Characters</span>
                <div className='detail-characters-list'>
                  {info.characters.nodes.map((character) => (
                    <MiniCard
                      key={character.id}
                      image={character.image?.medium}
                      text={character.name?.userPreferred ?? 'Unknown'}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail() {
  const { date, id } = useParams();
  const { search: rawSearch } = useLocation();
  const [searchParams] = useSearchParams();
  const search = scheduleSearch(rawSearch);
  const episodeNumber = Number(searchParams.get('ep'));
  const episodeParam = Number.isInteger(episodeNumber) && episodeNumber > 0 ? episodeNumber : null;
  const numericId = Number(id);
  const validId = Number.isInteger(numericId) && numericId > 0;
  const validDate = isValidDate(date);
  const variables = useMemo(() => ({ id: numericId }), [numericId]);
  const { loading, error, data, staleSince } = useAnilistQuery(DETAIL_QUERY, variables, {
    skip: !validId || !validDate,
  });
  const info = data?.Media;

  useDocumentTitle(info?.title?.userPreferred ?? null);
  useEffect(() => {
    if (!info || !validDate) return;
    addHistory({
      id: info.id,
      title: info.title?.userPreferred ?? 'Untitled',
      image: getSafeExternalUrl(info.coverImage?.extraLarge),
      date,
    });
  }, [info, validDate, date]);

  if (!validDate) return <Error msg='Invalid date. Use the YYYY-MM-DD format.' />;
  if (!validId) return <Error msg='Invalid item ID!' />;
  if (loading) return <DetailSkeleton />;
  if (error) {
    return (
      <Error
        title={getErrorStatus(error) === 404 ? 'Item Not Found!' : "Couldn't load this anime"}
        msg={getErrorStatus(error) === 404 ? null : describeAnilistError(error)}
      >
        <Link className='day-retry errorCmp-link' to={`/${date}${search}`}>
          Back to schedule
        </Link>
      </Error>
    );
  }
  if (!info) return <Error msg='Item Not Found!' />;

  return (
    <div className='detail-container'>
      <StaleNotice since={staleSince} />
      <DetailView info={info} date={date} search={search} episodeParam={episodeParam} />
    </div>
  );
}

export default Detail;
