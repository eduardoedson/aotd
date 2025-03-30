import Timer from './Timer';

function Card({ id, title, episode, imgSrc, color, description, links, timeUntilAiring }) {
  return (
    <div className='card-container' id={id} onClick={() => window.open(`/${id}`, '_self')}>
      <div className='card'>
        <img className='card-image' src={imgSrc} alt={title} />
        <div className='card-content'>
          <h2 className='card-title' style={{ color: color }}>{title}<br /><br />Episode: {episode}</h2>
          <p className='card-description' dangerouslySetInnerHTML={{__html: description}}></p>
          <div className='card-subcontent'>
            <div className='card-subcontent-links'>
              {links.map(link => link.icon ? <img src={link.icon} alt={link.site} onClick={() => window.open(link.url)} /> : null)}
            </div>
            {timeUntilAiring ? <div className='card-subcontent-timer'><Timer timeLeft={timeUntilAiring}/></div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
  
export default Card;
  