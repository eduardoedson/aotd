import Timer from './Timer';

function Card({ id, title, episode, imgSrc, color, description, links, timeUntilAiring, date }) {
  return (
    <div className='card-container' id={id}>
      <div className='card'>
        <img className='card-image' src={imgSrc} alt={title} />
        <div className='card-content' onClick={() => window.open(`/${date}/${id}`, '_self')}>
          <h2 className='card-title' style={{ color: color }}>{title}<br /><br />Episode: {episode}</h2>
          <p className='card-description' dangerouslySetInnerHTML={{__html: description}}></p>
        </div>
        <div className='card-subcontent'>
            <div className='card-subcontent-links'>
              {links.map(link => link.icon ? <img src={link.icon} alt={link.site} onClick={() => window.open(link.url, '_blank')} /> : null)}
            </div>
            {timeUntilAiring ? <div className='card-subcontent-timer'><Timer timeLeft={timeUntilAiring}/></div> : null}
          </div>
      </div>
    </div>
  );
}
  
export default Card;
  