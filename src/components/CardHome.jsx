import Timer from './Timer';
import { getSafeExternalUrl } from '../services/globals';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';

function Card({ id, title, episode, imgSrc, color, description, links, timeUntilAiring, date }) {
  const plainDescription = DOMPurify.sanitize(
    (description ?? '').replace(/<br\s*\/?\s*>/gi, ' '),
    { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }
  );

  return (
    <div className='card-container' id={id}>
      <div className='card' style={{ '--card-accent': color || '#ff3d8d' }}>
        <img className='card-image' src={imgSrc} alt={title} />
        <Link className='card-content' to={`/${date}/${id}`} aria-label={`View details for ${title}, episode ${episode}`}>
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
            <p className='card-description'>{plainDescription || 'No description is available yet.'}</p>
            <span className='card-hover-action'>View details <span aria-hidden='true'>→</span></span>
          </div>
        </Link>
        <div className='card-subcontent'>
          <div className='card-subcontent-links'>
            {(links ?? []).map(link => {
              const url = getSafeExternalUrl(link.url);
              const icon = getSafeExternalUrl(link.icon);
              return icon && url ? (
                <a key={`${link.site}-${url}`} href={url} target='_blank' rel='noopener noreferrer' aria-label={`Open ${link.site} in a new tab`} title={link.site}>
                  <img src={icon} alt='' />
                </a>
              ) : null;
            })}
          </div>
          {timeUntilAiring ? <div className='card-subcontent-timer'><Timer timeLeft={timeUntilAiring}/></div> : null}
        </div>
      </div>
    </div>
  );
}
  
export default Card;
  
