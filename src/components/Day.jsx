import Card from './Card';
import { useQuery, gql } from '@apollo/client';
import LoadingDiv from './Loading';
import Error from './Error';

const GET_DATA = gql`
query ($start: Int, $end: Int) {    
    Page(page: 1, perPage: 50) {      
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end) {
            episode
            airingAt
            timeUntilAiring
            media {
                id
                description (asHtml: false)
                title {
                    userPreferred 
                }
                coverImage {    
                    extraLarge    
                    color  
                }
                externalLinks {
                    site
                    icon
                    url
                }
            }      
        }    
    }  
}`;

function Day({ date }) {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    // AniList uses strict greater/lesser filters, so the range is expanded by one second.
    const startDate = Math.floor(startOfDay.getTime() / 1000) - 1;
    const endDate = Math.floor(endOfDay.getTime() / 1000);
    const { loading, error, data } = useQuery(GET_DATA, { variables: { start: startDate, end: endDate } });

    if (error) return <Error msg={error.message} />;

    const response = data?.Page?.airingSchedules ?? [];
    return <div className="day-container">{loading ? <LoadingDiv /> : response.map(item => { return <Card key={`${item.media.id}-${item.episode}`} type='HOME' item={item} date={date} /> })}</div>;
}
  
export default Day;
  

