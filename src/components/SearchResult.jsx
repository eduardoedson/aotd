import Card from './Card';
import Loading from './Loading';
import Error from './Error';

function SearchResult ({ data }) {
    return <>
        {data && data.success ? 
            data.items.length > 0 ? 
                data.items.map(item => <Card type='SEARCH' item={item} />)
                : <Error msg='Nothing found...' />
        : !data.success ? <Error /> : <Loading />}
    </>
}

export default SearchResult;