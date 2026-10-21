// GraphQL documents sent to AniList. Plain strings keep the bundle small.

export const SCHEDULE_QUERY = /* GraphQL */ `
  query Schedule($start: Int, $end: Int, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
      }
      airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
        id
        episode
        airingAt
        media {
          id
          isAdult
          siteUrl
          duration
          episodes
          status
          format
          genres
          description(asHtml: false)
          title {
            userPreferred
            romaji
            english
          }
          coverImage {
            medium
            large
            extraLarge
            color
          }
          externalLinks {
            id
            site
            icon
            url
          }
        }
      }
    }
  }
`;

export const DETAIL_QUERY = /* GraphQL */ `
  query MediaDetail($id: Int) {
    Media(id: $id) {
      id
      type
      format
      status
      season
      seasonYear
      countryOfOrigin
      meanScore
      popularity
      favourites
      hashtag
      isAdult
      rankings {
        id
        rank
        type
        allTime
        context
        season
        year
      }
      relations {
        edges {
          id
          relationType(version: 2)
          node {
            id
            type
            format
            title {
              userPreferred
            }
            coverImage {
              medium
            }
          }
        }
      }
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
        medium
        large
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

export const EPISODE_QUERY = /* GraphQL */ `
  query EpisodeAiring($mediaId: Int, $episode: Int) {
    AiringSchedule(mediaId: $mediaId, episode: $episode) {
      id
      episode
      airingAt
    }
  }
`;

export interface EpisodeResponse {
  AiringSchedule: { id: number; episode: number; airingAt: number } | null;
}

export const FAVORITE_EPISODES_QUERY = /* GraphQL */ `
  query FavoriteNextEpisodes($ids: [Int], $perPage: Int) {
    Page(perPage: $perPage) {
      media(id_in: $ids) {
        id
        title {
          userPreferred
        }
        coverImage {
          medium
        }
        nextAiringEpisode {
          episode
          airingAt
        }
      }
    }
  }
`;

export interface ExternalLink {
  id: number;
  site: string;
  icon?: string | null;
  url: string;
}

export interface ScheduleMedia {
  id: number;
  isAdult: boolean;
  siteUrl: string | null;
  duration: number | null;
  episodes: number | null;
  status: string | null;
  format?: string | null;
  genres: string[] | null;
  description: string | null;
  title: { userPreferred: string | null; romaji: string | null; english: string | null } | null;
  coverImage: {
    medium: string | null;
    large: string | null;
    extraLarge: string | null;
    color: string | null;
  } | null;
  externalLinks: ExternalLink[] | null;
}

export interface AiringItem {
  id: number;
  episode: number;
  airingAt: number;
  media: ScheduleMedia;
}

export interface ScheduleResponse {
  Page: {
    pageInfo: { currentPage: number; hasNextPage: boolean } | null;
    airingSchedules: (AiringItem | null)[] | null;
  } | null;
}

export interface MediaRanking {
  id: number;
  rank: number;
  type: 'RATED' | 'POPULAR';
  allTime: boolean | null;
  context: string;
  season: string | null;
  year: number | null;
}

export interface MediaRelation {
  id: number;
  relationType: string | null;
  node: {
    id: number;
    type: 'ANIME' | 'MANGA' | null;
    format: string | null;
    title: { userPreferred: string | null } | null;
    coverImage: { medium: string | null } | null;
  } | null;
}

export interface MediaDetail {
  id: number;
  type: 'ANIME' | 'MANGA' | null;
  format?: string | null;
  status: string | null;
  season?: string | null;
  seasonYear?: number | null;
  countryOfOrigin?: string | null;
  meanScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  hashtag?: string | null;
  isAdult?: boolean | null;
  rankings?: MediaRanking[] | null;
  relations?: { edges: MediaRelation[] } | null;
  description: string | null;
  siteUrl: string | null;
  episodes: number | null;
  chapters: number | null;
  duration: number | null;
  source: string | null;
  genres: string[] | null;
  synonyms: string[] | null;
  averageScore: number | null;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
    userPreferred: string | null;
  } | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  endDate: { year: number | null; month: number | null; day: number | null } | null;
  nextAiringEpisode: { id: number; episode: number; airingAt: number } | null;
  trailer: { id: string | null; site: string | null } | null;
  coverImage: {
    medium: string | null;
    large: string | null;
    extraLarge: string | null;
    color: string | null;
  } | null;
  tags: { id: number; name: string }[] | null;
  characters: {
    nodes: {
      id: number;
      name: { userPreferred: string | null } | null;
      image: { medium: string | null } | null;
    }[];
  } | null;
  studios: { nodes: { id: number; name: string }[] } | null;
  externalLinks: { id: number; url: string; site: string }[] | null;
}

export interface FavoriteEpisodesResponse {
  Page: {
    media: {
      id: number;
      title: { userPreferred: string | null } | null;
      coverImage: { medium: string | null } | null;
      nextAiringEpisode: { episode: number; airingAt: number } | null;
    }[];
  } | null;
}
