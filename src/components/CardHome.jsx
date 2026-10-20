import Timer from './Timer';
import { getSafeExternalUrl } from '../services/globals';
import { Link } from 'react-router-dom';

function Card({ id, title, episode, imgSrc, color, description, links, timeUntilAiring, date }) {
  return (
    <div className='card-container' id={id}>
      <div className='card'>
        <img className='card-image' src={imgSrc} alt={title} />
        <Link className='card-content' to={`/${date}/${id}`} aria-label={`View details for ${title}, episode ${episode}`}>
          <h2 className='card-title' style={{ color: color }}>{title}<br /><br />Episode: {episode}</h2>
          <p className='card-description'>{description}</p>
        </Link>
        <div className='card-subcontent'>
            <div className='card-subcontent-links'>
              {(links ?? []).map(link => {
                const url = getSafeExternalUrl(link.url);
                const icon = getSafeExternalUrl(link.icon);
                return icon && url ? (
                  <a key={`${link.site}-${url}`} href={url} target='_blank' rel='noopener noreferrer' aria-label={`Open ${link.site} in a new tab`}>
                    <img src={icon} alt={link.site} />
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
  
