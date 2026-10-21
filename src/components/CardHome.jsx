import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Timer from './Timer';
import FavoriteButton from './FavoriteButton';
import AddToCalendarButton from './AddToCalendarButton';
import UpcomingOnly from './UpcomingOnly';
import CardBadges from './CardBadges';
import ShareButton from './ShareButton';
import {
  formatAiringTime,
  getSafeExternalUrl,
  toPlainText,
  truncateText,
  uniqueLinks,
} from '../services/globals';
import { accentFor, textOn } from '../services/color';
import { useTheme } from '../services/preferences';
import { prefetchIntent } from '../services/prefetch';

const DESCRIPTION_LIMIT = 600;

// "priority" marks the first cards of the page: their images load eagerly
// because they are visible right away (largest contentful paint).
function CardHome({ item, date, search = '', timeZone = 'utc', priority = false }) {
  const { media, episode, airingAt } = item;
  const theme = useTheme();
  const title = media.title?.userPreferred ?? 'Untitled';
  const accent = accentFor(media.coverImage?.color, theme);
  const imgSrc = getSafeExternalUrl(media.coverImage?.extraLarge);
  const mediumImage = getSafeExternalUrl(media.coverImage?.medium);
  const largeImage = getSafeExternalUrl(media.coverImage?.large);
  const siteUrl = getSafeExternalUrl(media.siteUrl);
  const totalEpisodes =
    Number.isInteger(media.episodes) && media.episodes > 0 ? media.episodes : null;
  const detailPath = `/${date}/${media.id}${search}`;
  const episodeUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/${date}/${media.id}?ep=${episode}`;

  // Strip the HTML first and only then cut, so tags are never split in half.
  const description = useMemo(
    () => truncateText(toPlainText(media.description), DESCRIPTION_LIMIT),
    [media.description],
  );

  const links = useMemo(() => uniqueLinks(media.externalLinks), [media.externalLinks]);

  return (
    <article className='card-container' id={`airing-${item.id}`}>
      <div className='card' style={{ '--card-accent': accent, '--card-on-accent': textOn(accent) }}>
        {imgSrc ? (
          <img
            className='card-image'
            src={imgSrc}
            srcSet={[
              mediumImage && `${mediumImage} 230w`,
              largeImage && `${largeImage} 460w`,
              `${imgSrc} 920w`,
            ]
              .filter(Boolean)
              .join(', ')}
            sizes='(max-width: 767px) 90vw, 270px'
            alt=''
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding='async'
          />
        ) : (
          <div className='card-image card-image-placeholder' aria-hidden='true' />
        )}
        <Link
          className='card-content'
          to={detailPath}
          aria-label={`View details for ${title}, episode ${episode}${totalEpisodes ? ` of ${totalEpisodes}` : ''}`}
          {...prefetchIntent(media.id)}
        >
          <div className='card-summary'>
            <CardBadges
              episode={episode}
              totalEpisodes={totalEpisodes}
              airingAt={airingAt}
              duration={media.duration}
            />
            <h2 className='card-title'>{title}</h2>
            <div className='card-meta'>
              <div className='card-episode'>
                <span>Episode</span>
                <strong>
                  {episode}
                  {totalEpisodes ? `/${totalEpisodes}` : ''}
                </strong>
              </div>
              <time className='card-time' dateTime={new Date(airingAt * 1000).toISOString()}>
                {formatAiringTime(airingAt, timeZone)}
              </time>
            </div>
          </div>
          <div className='card-hover-content'>
            <span className='card-hover-eyebrow'>About this episode</span>
            <h3>{title}</h3>
            <p className='card-description'>{description || 'No description is available yet.'}</p>
            <span className='card-hover-action'>
              View details <span aria-hidden='true'>→</span>
            </span>
          </div>
        </Link>
        <FavoriteButton className='card-favorite' id={media.id} title={title} image={imgSrc} />
        <div className='card-subcontent'>
          <div className='card-subcontent-links'>
            {links.map((link) => (
              <a
                key={link.id ?? `${link.site}-${link.url}`}
                href={link.url}
                target='_blank'
                rel='noopener noreferrer'
                aria-label={`Open ${link.site} in a new tab`}
                title={link.site}
              >
                <img src={link.icon} alt='' loading='lazy' decoding='async' />
              </a>
            ))}
            <ShareButton
              compact
              className='card-action'
              title={`${title} episode ${episode}`}
              url={episodeUrl}
              label={`Share episode ${episode}`}
            />
            <UpcomingOnly airingAt={airingAt}>
              <AddToCalendarButton
                className='card-action'
                mediaId={media.id}
                title={title}
                episode={episode}
                airingAt={airingAt}
                duration={media.duration}
                url={siteUrl}
              />
            </UpcomingOnly>
          </div>
          <div className='card-subcontent-timer'>
            <Timer airingAt={airingAt} />
          </div>
        </div>
      </div>
    </article>
  );
}

export default CardHome;
