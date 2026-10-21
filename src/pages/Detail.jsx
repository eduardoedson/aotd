import { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { Link, useLocation, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import Loading from '../components/Loading';
import Tag from '../components/Tag';
import MiniCard from '../components/MiniCard';
import StarRating from '../components/StarRating';
import FavoriteButton from '../components/FavoriteButton';
import AddToCalendarButton from '../components/AddToCalendarButton';
import Timer from '../components/Timer';
import UpcomingOnly from '../components/UpcomingOnly';
import Error from './Error';
import {
  DEFAULT_ACCENT,
  formatFuzzyDate,
  getSafeExternalUrl,
  humanizeEnum,
  isValidDate,
} from '../services/globals';
import { getHttpStatus } from '../services/backend';
import { useDocumentTitle } from '../services/useDocumentTitle';
import { DETAIL_QUERY } from '../services/detail';

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

function DetailView({ info, date, search }) {
  const title = info.title?.userPreferred ?? 'Untitled';
  const isAnime = info.type === 'ANIME';
  const coverImage = getSafeExternalUrl(info.coverImage?.extraLarge);
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

  return (
    <div
      className='detail-content'
      style={{ '--detail-accent': info.coverImage?.color || DEFAULT_ACCENT }}
    >
      {/* On wide screens the two columns flow independently; on small screens the
          columns use display: contents and the blocks are reordered with CSS only. */}
      <div className='detail-layout'>
        <div className='detail-column detail-column-left'>
          <div className='detail-block detail-block-cover'>
            {coverImage ? <img className='detail-cover' src={coverImage} alt={title} /> : null}
            {info.averageScore ? <StarRating score={info.averageScore} /> : null}
            <FavoriteButton
              className='detail-favorite'
              id={info.id}
              title={title}
              image={coverImage}
              showLabel
            />
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
              {info.status ? <Category title='Status'>{humanizeEnum(info.status)}</Category> : null}
              {info.source ? <Category title='Source'>{humanizeEnum(info.source)}</Category> : null}
              <Category title={isAnime ? 'Episodes' : 'Chapters'}>{count || 'Unknown'}</Category>
              <Category title='Start Date'>{formatFuzzyDate(info.startDate ?? undefined)}</Category>
              <Category title='End Date'>{formatFuzzyDate(info.endDate ?? undefined)}</Category>
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
  const { search } = useLocation();
  const numericId = Number(id);
  const validId = Number.isInteger(numericId) && numericId > 0;
  const validDate = isValidDate(date);
  const { loading, error, data } = useQuery(DETAIL_QUERY, {
    variables: { id: numericId },
    skip: !validId || !validDate,
  });
  const info = data?.Media;

  useDocumentTitle(info?.title?.userPreferred ?? null);

  if (!validDate) return <Error msg='Invalid date. Use the YYYY-MM-DD format.' />;
  if (!validId) return <Error msg='Invalid item ID!' />;
  if (loading) return <Loading />;
  if (error) {
    return <Error msg={getHttpStatus(error) === 404 ? 'Item Not Found!' : error.message} />;
  }
  if (!info) return <Error msg='Item Not Found!' />;

  return (
    <div className='detail-container'>
      <DetailView info={info} date={date} search={search} />
    </div>
  );
}

export default Detail;
