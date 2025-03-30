import CardHome from './CardHome';
import CardSearch from './CardSearch';

function Card({ type, item }) {
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
      />
    case 'SEARCH':
      return  <CardSearch 
        id={item.id}
        title={item.title.userPreferred}
        description={item.description ? (item.description.length > 350 ? item.description.slice(0, 350) + '...' : item.description) : null}
        imgSrc={item.coverImage.extraLarge}
        color={item.coverImage.color}
        genres={item.genres || []}
      />
    default:
      return null
  }
}
  
export default Card;
  