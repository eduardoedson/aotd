import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Library from './Library';
import { favoritesStore } from '../services/favorites';
import { clearQueryCache } from '../services/useAnilistQuery';
import { mockAnilist } from '../test/anilistMock';

afterEach(() => {
  clearQueryCache();
  favoritesStore.reset();
});

describe('Library', () => {
  it('loads the next episode of every favorite, in batches of 50', async () => {
    const ids = Array.from({ length: 60 }, (_, index) => index + 1);
    favoritesStore.set(
      Object.fromEntries(ids.map((id) => [id, { id, title: `Anime ${id}`, addedAt: id }])),
    );
    const soon = Math.floor(Date.now() / 1000) + 3600;
    const fetchMock = mockAnilist(({ name, variables }) =>
      name === 'FavoriteNextEpisodes'
        ? {
            data: {
              Page: {
                media: variables.ids.map((id) => ({
                  id,
                  title: { userPreferred: `Anime ${id}` },
                  coverImage: null,
                  nextAiringEpisode: { episode: 2, airingAt: soon },
                })),
              },
            },
          }
        : undefined,
    );

    render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );

    // Every favorite airs within the hour, including the ones past the first 50.
    const stat = await screen.findByText('Airing this week');
    await waitFor(() => expect(stat.parentElement).toHaveTextContent('60'));
    const batches = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(init.body).variables.ids.length,
    );
    expect(batches.sort((a, b) => b - a)).toEqual([50, 10]);
  });
});
