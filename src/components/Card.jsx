import CardHome from './CardHome';

function Card({ type, item, date }) {
  switch (type) {
    case 'HOME':
      return <CardHome 
        id={item.media.id}
        title={item.media.title.userPreferred}
        episode={item.episode}
        imgSrc={item.media.coverImage.extraLarge}
        color={item.media.coverImage.color}
        description={item.media.description ? (item.media.description.length > 450 ? item.media.description.slice(0, 450) + '...' : item.media.description) : null}
        links={item.media.externalLinks}
        timeUntilAiring={item.timeUntilAiring}
        date={date}
      />
    default:
      return null
  }
}
  
export default Card;
  