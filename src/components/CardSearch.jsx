import Tag from './Tag';

function CardSearch({ id, description, title, imgSrc, color, genres }) {
  return (
    <div className='card-container' id={id} onClick={() => window.open(`/${id}`, '_self')}>
      <div className='card'>
        <img className='card-image' src={imgSrc} alt={title} />
        <div className='card-content'>
          <h2 className='card-title' style={{ color: color }}>{title}</h2>
          <p className='card-description' dangerouslySetInnerHTML={{__html: description}}></p>
          <div className='card-subcontent'>
            <div className='card-subcontent-links'>{genres.map(genre => <Tag text={genre} />)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
  
export default CardSearch;
  