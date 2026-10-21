import type { Page, Route } from '@playwright/test';

const GENRES = [
  ['Action', 'Fantasy'],
  ['Comedy', 'Slice of Life'],
  ['Romance', 'Drama'],
  ['Sci-Fi', 'Mecha'],
];
const COLORS = ['#e4a15d', '#5da0e4', '#e45d9b', '#6be45d'];

// 1x1 transparent PNG used for every remote image.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export function scheduleItem(index: number, airingAt: number) {
  return {
    id: 1000 + index,
    episode: (index % 12) + 1,
    airingAt,
    media: {
      id: 500 + index,
      isAdult: false,
      siteUrl: `https://anilist.co/anime/${500 + index}`,
      duration: 24,
      genres: GENRES[index % 4],
      description: `Show number ${index} &amp; friends.<br>An <i>epic</i> story.`,
      title: {
        userPreferred: `Mock Anime ${String(index).padStart(2, '0')}`,
        romaji: `Mock Anime ${String(index).padStart(2, '0')}`,
        english: null,
      },
      coverImage: {
        extraLarge: `https://s4.anilist.co/cover/${index}.png`,
        color: COLORS[index % 4],
      },
      externalLinks: [
        {
          id: index * 3,
          site: 'Crunchyroll',
          icon: 'https://s4.anilist.co/icon/cr.png',
          url: 'https://www.crunchyroll.com/',
        },
      ],
    },
  };
}

export function mediaDetail(id: number, now: number) {
  return {
    id,
    type: 'ANIME',
    status: 'RELEASING',
    description: '<p>Elf mage Frieren and her fellow adventurers have defeated the Demon King.</p>',
    siteUrl: `https://anilist.co/anime/${id}`,
    episodes: 28,
    chapters: null,
    duration: 24,
    source: 'MANGA',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    synonyms: ['Frieren at the Funeral'],
    averageScore: 91,
    title: {
      romaji: 'Sousou no Frieren',
      english: 'Frieren: Beyond Journey’s End',
      native: '葬送のフリーレン',
      userPreferred: 'Sousou no Frieren',
    },
    startDate: { year: 2023, month: 9, day: 29 },
    endDate: { year: null, month: null, day: null },
    nextAiringEpisode: { id: 77, episode: 29, airingAt: Math.floor(now / 1000) + 3 * 86400 },
    trailer: null,
    coverImage: { extraLarge: 'https://s4.anilist.co/cover/detail.png', color: '#e4a15d' },
    tags: [{ id: 1, name: 'Elf' }],
    characters: {
      nodes: [
        {
          id: 1,
          name: { userPreferred: 'Frieren' },
          image: { medium: 'https://s4.anilist.co/c.png' },
        },
      ],
    },
    studios: { nodes: [{ id: 11, name: 'Madhouse' }] },
    externalLinks: [{ id: 1, url: 'https://www.crunchyroll.com/frieren', site: 'Crunchyroll' }],
  };
}

// Serves a fake AniList API: 62 episodes per day split over two pages.
export async function mockAnilist(page: Page) {
  const calls: { name: string; variables: Record<string, number> }[] = [];

  await page.route('https://graphql.anilist.co/**', async (route: Route) => {
    const { query, variables } = JSON.parse(route.request().postData() ?? '{}');
    const name = String(query.match(/query\s+(\w+)/)?.[1]);
    calls.push({ name, variables });

    if (name === 'Schedule') {
      const pageNumber = variables.page as number;
      const first = (pageNumber - 1) * 50;
      const count = pageNumber === 1 ? 50 : 12;
      const span = variables.end - variables.start;
      const items = Array.from({ length: count }, (_, offset) => {
        const index = first + offset;
        return scheduleItem(index, variables.start + 1 + Math.floor(((index + 0.5) / 62) * span));
      });
      return route.fulfill({
        json: {
          data: {
            Page: {
              pageInfo: { currentPage: pageNumber, hasNextPage: pageNumber === 1 },
              airingSchedules: items,
            },
          },
        },
      });
    }
    if (name === 'EpisodeAiring') {
      return route.fulfill({
        json: {
          data: {
            AiringSchedule: {
              id: 1,
              episode: variables.episode,
              airingAt: Math.floor(Date.now() / 1000) + 7200,
            },
          },
        },
      });
    }
    if (name === 'MediaDetail') {
      return route.fulfill({ json: { data: { Media: mediaDetail(variables.id, Date.now()) } } });
    }
    return route.fulfill({ json: { data: { Page: { media: [] } } } });
  });

  await page.route('https://s4.anilist.co/**', (route) =>
    route.fulfill({ body: PIXEL, contentType: 'image/png' }),
  );
  await page.route(/googletagmanager|google-analytics|youtube/, (route) => route.abort());

  return calls;
}
