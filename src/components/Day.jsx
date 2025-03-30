import Card from './Card';
import { useQuery, gql } from '@apollo/client';
import LoadingDiv from './Loading';
import Error from './Error';

const GET_DATA = gql`
query ($start: Int, $end: Int) {    
    Page {      
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
    const startDate = new Date(`${date}T00:01:00.000Z`).getTime() / 1000; // Pass to seconds
    const endDate = new Date(`${date}T23:59:00.000Z`).getTime() / 1000; // Pass to seconds
    const { loading, error, data } = useQuery(GET_DATA, { variables: { start: startDate, end: endDate } });

    if (error) return <Error msg={error.message} />;

    const response = data?.Page.airingSchedules;
    return <div className="day-container">{loading ? <LoadingDiv /> : response.map(item => { return <Card type='HOME' item={item} /> })}</div>;
}
  
export default Day;
  

