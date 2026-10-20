import React from 'react';
import { useQuery, gql } from '@apollo/client';
import { useParams } from 'react-router-dom';
import LoadingDiv from '../components/Loading';
import Tag from '../components/Tag';
import MiniCard from '../components/MiniCard';
import Error from './Error';
import Rating from '@mui/material/Rating';
import Tooltip from '@mui/material/Tooltip';
import DOMPurify from 'dompurify';
import { months, leftPad, capitalizeFirstLetter, getSafeExternalUrl, isValidDate } from '../services/globals';

const GET_DATA = gql`
query ($id: Int) {  
    Page {
      media (id: $id) {
        title {
            romaji
            english
            native
            userPreferred
        }
        type
        status
        description
        startDate {
            year
            month
            day
        }
        endDate {
            year
            month
            day
        }
        episodes
        chapters
        source
        trailer {
            id
            site
            thumbnail
        }
        coverImage {
            extraLarge
            color
        }
        genres
        synonyms
        averageScore
        tags {
            name
        }
        characters {
          nodes {
            name {
                userPreferred
            }
            image {
                medium
            }
          }
        }
        studios {
            nodes {
                name
            }
        }
        externalLinks {
            url
            site
        }
      }
    }
}`;

function Detail () {
    const { date, id } = useParams();
    const numericId = Number(id);
    const validId = Number.isInteger(numericId) && numericId > 0;
    const validDate = isValidDate(date);
    const { loading, error, data } = useQuery(GET_DATA, {
        variables: { id: numericId },
        skip: !validId || !validDate
    });
    const isMobile = (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth) <= 1400; 

    if (!validDate) return <Error msg={'Invalid date. Use the YYYY-MM-DD format.'} />;

    if (!validId) return <Error msg={'Invalid item ID!'} />;

    if (loading) return <LoadingDiv />;

    if (error) return <Error msg={error.message} />;

    const response = data?.Page?.media;
    if (response?.length !== 1) return <Error msg={'Item Not Found!'} />;
    const info = response[0];

    const formatDate = ({year, month, day} = {}) => {
        if (!year || !month || !day) return '???'
        return `${months[month - 1]} ${leftPad(day, 2)}, ${year}`;
    }

    const mountScreen = () => {
        const main = (children) => <div className='detail-content'>{children}</div>;
        
        const content = (children) =>  <div className='detail-split-content'>{children}</div>;
        const left = (children) =>  <div className='detail-split-content-left'>{children}</div>;
        const right = (children) =>  <div className='detail-split-content-right'>{children}</div>;

        const line = (children) => <div className='detail-category-line'>{children}</div>;

        const preferredTitle = info.title?.userPreferred ?? 'Untitled';
        const coverImage = getSafeExternalUrl(info.coverImage?.extraLarge);
        const img = coverImage ? <img src={coverImage} alt={preferredTitle} /> : null;
        const raiting = info.averageScore ? (<Tooltip title={info.averageScore / 10 / 2} arrow>
            <div className='detail-raiting'>
                <Rating className='raiting-stars' value={info.averageScore / 10 / 2} precision={0.1} size='large' readOnly />
            </div>
        </Tooltip>) : null;
        const alternativeTitles = Object.keys(info.title ?? {}).length > 0 ? <div className='detail-category'>
            <span className='detail-category-title'>Alternative Titles</span>
            <span className='detail-category-description'>
                {Object.keys(info.title ?? {}).map(key => key !== 'userPreferred' && key !== '__typename' && info.title[key] ? <span>{info.title[key]}</span> : null)}
            </span>
        </div> : null;
        const synonyms = info.synonyms?.length > 0 ? <div className='detail-category'>
            <span className='detail-category-title'>Synonyms</span>
            <span className='detail-category-description'>
                {info.synonyms.map(synonym => <span>{synonym}</span>)}
            </span>
        </div> : null;
        const genres = info.genres?.length > 0 ? <div className='detail-category'>
            <span className='detail-category-title'>Genres</span>
            <span className='detail-category-description-inline'>
                {info.genres.map(genre => <Tag text={genre} />)}
            </span>
        </div> : null;
        const tags = info.tags?.length > 0 ? <div className='detail-category'>
            <span className='detail-category-title'>Tags</span>
            <span className='detail-category-description-inline'>
                {info.tags.map(tag => <Tag text={tag.name} />)}
            </span>
        </div> : null;
        const studios = info.studios?.nodes?.length > 0 ? <div className='detail-category'>
            <span className='detail-category-title'>Studios</span>
            <span className='detail-category-description'>
                {info.studios.nodes.map(studio => <span>{studio.name}</span>)}
            </span>
        </div> : null;
        const safeLinks = (info.externalLinks ?? [])
            .map(link => ({ ...link, url: getSafeExternalUrl(link.url) }))
            .filter(link => link.url);
        const links = safeLinks.length > 0 ? <div className='detail-category'>
            <span className='detail-category-title'>Useful Links</span>
            <span className='detail-category-description'>
                {safeLinks.map(link => (
                    <a key={`${link.site}-${link.url}`} href={link.url} target='_blank' rel='noopener noreferrer'>
                        {link.site}
                    </a>
                ))}
            </span>
        </div> : null;
        const title = <div className='detail-title' style={{ color: info.coverImage?.color }}>{preferredTitle}</div>;
        const sanitizedDescription = DOMPurify.sanitize(info.description ?? '');
        const description = <div className='detail-description' dangerouslySetInnerHTML={{__html: sanitizedDescription}}></div>;
        const status = info.status ? <div className='detail-category'>
            <span className='detail-category-title'>Status</span>
            <span className='detail-category-description'>{capitalizeFirstLetter(info.status).replace(/_/g, ' ')}</span>
        </div> : null;
        const source = info.source ? <div className='detail-category'>
            <span className='detail-category-title'>Source</span>
            <span className='detail-category-description'>{capitalizeFirstLetter(info.source).replace(/_/g, ' ')}</span>
        </div> : null;
        const qtde = <div className='detail-category'>
            <span className='detail-category-title'>{info.type === 'ANIME' ? 'Episodes' : 'Chapters'}</span>
            <span className='detail-category-description'>{
                info.type === 'ANIME' ? 
                    (info.episodes ? info.episodes : 'Unknown')
                :
                    (info.chapters ? info.chapters : 'Unknown')
            }</span>
        </div>;
        const startDate = <div className='detail-category'>
            <span className='detail-category-title'>Start Date</span>
            <span className='detail-category-description'>{'startDate' in info ? formatDate(info.startDate) : '???'}</span>
        </div>;
        const endDate = <div className='detail-category'>
            <span className='detail-category-title'>End Date</span>
            <span className='detail-category-description'>{'endDate' in info ? formatDate(info.endDate) : '???'}</span>
        </div>
        const trailerId = info.trailer?.site === 'youtube' && /^[\w-]+$/.test(info.trailer.id ?? '')
            ? info.trailer.id
            : null;
        const trailer = trailerId ? <div className='detail-trailer'>
            <iframe 
                className='detail-trailer-iframe'
                title={preferredTitle}
                src={`https://www.youtube.com/embed/${trailerId}`}
                frameborder='0'
                allowfullscreen
            >
            </iframe> 
        </div> : null;
        const characters = info.characters?.nodes?.length > 0 ? <div className='detail-characters'>
            <span className='detail-category-title'>Characters</span>
            <div className='detail-characters-list'>
                {info.characters.nodes.map(char => <MiniCard image={char.image.medium} text={char.name.userPreferred} />)}
            </div>
        </div> : null;

        if (isMobile) {
            return main(
                content([
                    img,
                    raiting,
                    title, 
                    description,
                    alternativeTitles,
                    synonyms, 
                    genres,
                    tags,
                    studios,
                    links,
                    status, 
                    source, 
                    qtde, 
                    startDate, 
                    endDate,
                    trailer,
                    characters
                ])
            )
        } else {
            return main(
                content([
                    left([
                        img,
                        raiting,
                        alternativeTitles,
                        synonyms, 
                        genres,
                        tags,
                        studios,
                        links
                    ]),
                    right([
                        title, 
                        description,
                        line(
                            [status, 
                            source, 
                            qtde, 
                            startDate, 
                            endDate
                        ]),
                        trailer,
                        characters
                    ])
                ])
            )
        }
    }

    return (
        <div className='detail-container'>
            {loading ? <LoadingDiv /> : mountScreen()}
        </div>
    )
}

export default Detail;
