import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Timer from './Timer';
import FavoriteButton from './FavoriteButton';
import AddToCalendarButton from './AddToCalendarButton';
import UpcomingOnly from './UpcomingOnly';
import { DEFAULT_ACCENT, getSafeExternalUrl, toPlainText, truncateText } from '../services/globals';

const DESCRIPTION_LIMIT = 600;

function CardHome({ item, date, search = '' }) {
  const { media, episode, airingAt } = item;
  const title = media.title?.userPreferred ?? 'Untitled';
  const color = media.coverImage?.color || DEFAULT_ACCENT;
  const imgSrc = getSafeExternalUrl(media.coverImage?.extraLarge);
  const siteUrl = getSafeExternalUrl(media.siteUrl);

  // Strip the HTML first and only then cut, so tags are never split in half.
  const description = useMemo(
    () => truncateText(toPlainText(media.description), DESCRIPTION_LIMIT),
    [media.description],
  );

  const links = (media.externalLinks ?? [])
    .map((link) => ({
      ...link,
      url: getSafeExternalUrl(link.url),
      icon: getSafeExternalUrl(link.icon),
    }))
    .filter((link) => link.url && link.icon);

  return (
    <article className='card-container'>
      <div className='card' style={{ '--card-accent': color }}>
        {imgSrc ? (
          <img className='card-image' src={imgSrc} alt='' loading='lazy' decoding='async' />
        ) : (
          <div className='card-image card-image-placeholder' aria-hidden='true' />
        )}
        <Link
          className='card-content'
          to={`/${date}/${media.id}${search}`}
          aria-label={`View details for ${title}, episode ${episode}`}
        >
          <div className='card-summary'>
            <h2 className='card-title'>{title}</h2>
            <div className='card-episode'>
              <span>Episode</span>
              <strong>{episode}</strong>
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
