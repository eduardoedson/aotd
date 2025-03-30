import { useEffect, useState } from 'react';
import { useLazyQuery , gql } from '@apollo/client';
import Input from './Input';
import Loading from './Loading';
import SearchResult from './SearchResult';
import { useParams, useNavigate  } from 'react-router-dom';
import { getToday } from '../services/globals';

const GET_DATA = gql`
query($page:Int = 1 
$id:Int 
$type:MediaType 
$search:String 
$status:MediaStatus 
$year:String 
$yearLesser:FuzzyDateInt
$yearGreater:FuzzyDateInt 
$genres:[String]
$excludedGenres:[String]
$tags:[String]
$excludedTags:[String]
$sort:[MediaSort]=[TITLE_ROMAJI]) {
  Page(page:$page, perPage:12) {
    pageInfo {
      total 
      perPage 
      currentPage 
      lastPage 
      hasNextPage
    }
    media(id:$id 
      type:$type 
      status:$status 
      search:$search 
      startDate_like:$year 
      startDate_lesser:$yearLesser 
      startDate_greater:$yearGreater
      genre_in:$genres 
      genre_not_in:$excludedGenres 
      tag_in:$tags 
      tag_not_in:$excludedTags 
      sort:$sort) {
      id 
      description (asHtml: false)
      title {
        userPreferred
      }
      coverImage { 
        extraLarge
        color
      }
      genres
    }
  }
}`;

function SearchForm () {
    const params = useParams();
    const navigate = useNavigate();

    const type = useState(params.type || 'ANIME');
    const [page, setPage] = useState(params.page || 1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [year, setYear] = useState(params.year || getToday().split('-')[0]);
    const [status, setStatus] = useState(params.status);
    const [search, setSearch] = useState(params.search ? decodeURIComponent(params.search) : null);

    const [response, setResponse] = useState({success: false, items: []});
    
    const variables = { page, type, year: `${year}%` }
    if (status && status !== '-') variables['status'] = status 
    if (search) variables['search'] = search

    const [lazyQuery, { loading, error, data }] = useLazyQuery(GET_DATA, { variables: variables});

    useEffect(() => {
      if (!loading && !error) {
        setHasNextPage(data?.Page?.pageInfo?.hasNextPage || false);

        if (data?.Page?.media) {
          setResponse({success: true, items: data.Page.media});
        } else {
          setResponse({success: false, items: []});
        }
      }

    }, [data, error, loading])

    useEffect(() => {
      lazyQuery()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      // if (page !== 1) {
        setPage(1)
      // } else {
      //   submit()
      // }
    }, [type, year, status, search])

    useEffect(() => {
      submit()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page])

    const submit = () => {
      const baseUrl = `/search/${type}/${page}/${year}`

      if (!status && !search) navigate(baseUrl);
      if (status) navigate(`${baseUrl}/${status}`)
      if (status && search) navigate(`${baseUrl}/${status}/${search}`)
      if (!status && search) navigate(`${baseUrl}/-/${search}`)
    }

    const statusOptions = [
      { label: '', value: ''},
      { label: 'Releasing', value: 'RELEASING' },
      { label: 'Finished', value: 'FINISHED' },
      { label: 'Not Yet Released', value: 'NOT_YET_RELEASED' },
      { label: 'Hiatus', value: 'HIATUS' },
      { label: 'Cancelled', value: 'CANCELLED' }
    ]

    const yearOptions = () => {
      const arr = [];
      const currentYar = parseInt(getToday().split('-')[0]);
      for (let i = currentYar; i >= 1990; i--) {
        arr.push({ label: i, value: i });
      }
      return arr;
    }

    return (
      <div className='searchForm-container'>
        <div className='searchForm-inputs'>
          <Input
            id='search-form-input-search'
            type='text'
            label='Search'
            value={search}
            set={setSearch}
            readOnly={false}
          />
          <Input 
            id='search-form-select-status'
            type='select'
            label='Status'
            options={statusOptions}
            selectedOption={status}
            set={setStatus}
            readOnly={false}
          />
          <Input 
            id='search-form-select-year'
            type='select'
            label='Year'
            options={yearOptions()}
            selectedOption={year}
            set={setYear}
            readOnly={false}
          />
          {/* <Button id='search-form-submit-button' label='Search' fnClick={submit} /> */}
        </div>

        <div className='searchForm-results'>{loading ? <Loading /> : 
          <>
            <div className='searchForm-results-cards'><SearchResult data={response} /></div>
              <div className='searchForm-results-info'>Page {params.page}</div>
              <div className='searchForm-results-pagination'>
                {/* <div className={`searchForm-results-pagination-button ${page === 1 ? 'pagination-button-disabled': null}`} onClick={() => page > 1 ? setPage(page - 1) : null}>Previous Page</div>
                <div className={`searchForm-results-pagination-button ${!hasNextPage ? 'pagination-button-disabled': null}`} onClick={() => hasNextPage ? setPage(page + 1) : null}>Next Page</div> */}
              </div>
          </>}
        </div>
      </div>
    )
}

export default SearchForm;