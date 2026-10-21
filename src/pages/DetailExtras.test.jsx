import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Detail from './Detail';
import { clearQueryCache } from '../services/useAnilistQuery';
import { scheduleContextStore } from '../services/navigation';
import { mockAnilist } from '../test/anilistMock';

const media = (id, title) => ({
  id,
  type: 'ANIME',
  format: 'TV',
  status: 'RELEASING',
  season: 'FALL',
  seasonYear: 2026,
  countryOfOrigin: 'JP',
  meanScore: 88,
  popularity: 123456,
  favourites: 7890,
  hashtag: '#frieren',
  description: 'Story',
  siteUrl: null,
  episodes: 12,
  chapters: null,
  duration: 24,
  source: 'MANGA',
  genres: [],
  synonyms: [],
  averageScore: null,
  title: { romaji: title, english: null, native: null, userPreferred: title },
  startDate: null,
  endDate: null,
  nextAiringEpisode: null,
  trailer: null,
  coverImage: { extraLarge: null, large: null, medium: null, color: '#1a0f35' },
  tags: [],
  characters: { nodes: [] },
  studios: { nodes: [] },
  externalLinks: [],
  rankings: [
    {
      id: 1,
      rank: 3,
      type: 'RATED',
      allTime: false,
      context: 'highest rated',
      season: 'FALL',
      year: 2026,
    },
  ],
  relations: {
    edges: [
      {
        id: 9,
        relationType: 'PREQUEL',
        node: {
          id: 50,
          type: 'ANIME',
          format: 'TV',
          title: { userPreferred: 'Season One' },
          coverImage: null,
        },
      },
    ],
  },
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid='location'>{location.pathname}</div>;
}

const renderDetail = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path='/:date/:id'
          element={
            <>
              <Detail />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => {
  clearQueryCache();
  scheduleContextStore.set(null);
});

describe('Detail extras', () => {
  it('shows the complete metadata, rankings and related titles', async () => {
    mockAnilist(({ name, variables }) =>
      name === 'MediaDetail' ? { data: { Media: media(variables.id, 'Frieren') } } : undefined,
    );
    renderDetail('/2026-10-21/1');

    expect(await screen.findByRole('heading', { level: 1, name: 'Frieren' })).toBeInTheDocument();
    expect(screen.getByText('Fall 2026')).toBeInTheDocument();
    expect(screen.getByText('24 min per episode')).toBeInTheDocument();
    expect(screen.getByText('Japan')).toBeInTheDocument();
    expect(screen.getByText('123,456 users')).toBeInTheDocument();
    expect(screen.getByText('#3 Highest rated (Fall 2026)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Season One/ })).toHaveAttribute(
      'href',
      '/2026-10-21/50',
    );

    // A very dark cover color is lightened so the accent stays readable.
    const accent = document
      .querySelector('.detail-content')
      .style.getPropertyValue('--detail-accent');
    expect(accent).not.toBe('#1a0f35');
  });

  it('links to the previous and next anime of the schedule', async () => {
    scheduleContextStore.set({
      search: '?genre=Action',
      entries: [1, 2, 3].map((mediaId) => ({
        mediaId,
        title: `Anime ${mediaId}`,
        date: '2026-10-21',
        episode: 1,
      })),
    });
    mockAnilist(({ name, variables }) =>
      name === 'MediaDetail'
        ? { data: { Media: media(variables.id, `Anime ${variables.id}`) } }
        : undefined,
    );
    renderDetail('/2026-10-21/2');

    const nav = await screen.findByRole('navigation', { name: 'Previous and next anime' });
    expect(within(nav).getByRole('link', { name: /Previous\s*Anime 1/ })).toHaveAttribute(
      'href',
      '/2026-10-21/1?genre=Action',
    );
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('location')).toHaveTextContent('/2026-10-21/3');
  });

  it('shows the shared episode from the link', async () => {
    mockAnilist(({ name, variables }) => {
      if (name === 'MediaDetail') return { data: { Media: media(variables.id, 'Frieren') } };
      if (name === 'EpisodeAiring') {
        return {
          data: {
            AiringSchedule: {
              id: 1,
              episode: variables.episode,
              airingAt: Date.UTC(2026, 9, 21, 15, 30) / 1000,
            },
          },
        };
      }
      return undefined;
    });
    renderDetail('/2026-10-21/1?ep=7');

    const banner = await screen.findByRole('note');
    expect(within(banner).getByText(/Episode 7, Wednesday, 21 Oct 2026/)).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Share episode' })).toBeInTheDocument();
  });
});
