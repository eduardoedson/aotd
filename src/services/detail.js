import { gql } from '@apollo/client';

export const DETAIL_QUERY = gql`
  query MediaDetail($id: Int) {
    Media(id: $id) {
      id
      type
      status
      description
      siteUrl
      episodes
      chapters
      duration
      source
      genres
      synonyms
      averageScore
      title {
        romaji
        english
        native
        userPreferred
      }
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
      nextAiringEpisode {
        id
        episode
        airingAt
      }
      trailer {
        id
        site
      }
      coverImage {
        extraLarge
        color
      }
      tags {
        id
        name
      }
      characters(perPage: 12, sort: [ROLE, RELEVANCE, ID]) {
        nodes {
          id
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
          id
          name
        }
      }
      externalLinks {
        id
        url
        site
      }
    }
  }
`;
