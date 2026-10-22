import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Day from './Day';
import { clearScheduleCache } from '../services/schedule';
import { favoritesStore } from '../services/favorites';
import { getDayRange } from '../services/globals';
import { writePersistent } from '../services/persistentCache';
import { graphQLError, mockAnilist } from '../test/anilistMock';

const DATE = '2026-10-21';
const RANGE = getDayRange(DATE, 'utc');

const makeItem = (id, title, genres = ['Action'], isAdult = false) => ({
  id: id * 10,
  episode: id,
  airingAt: Date.UTC(2026, 9, 21, 12) / 1000,
  media: {
    id,
    isAdult,
    siteUrl: `https://anilist.co/anime/${id}`,
    duration: 24,
    genres,
    description: `<b>${title}</b> description`,
    title: { userPreferred: title, romaji: title, english: null },
    coverImage: { extraLarge: `https://s4.anilist.co/${id}.jpg`, color: '#123456' },
    externalLinks: [],
  },
});

const page = (items, pageNumber, hasNextPage) => ({
  data: {
    Page: { pageInfo: { currentPage: pageNumber, hasNextPage }, airingSchedules: items },
  },
});

// Serves the given pages for the tested day and empty pages for its neighbours.
const serveDay = (pages) =>
  mockAnilist(({ name, variables }) => {
    if (name !== 'Schedule') return undefined;
    if (variables.start !== RANGE.start) return page([], 1, false);
    const handler = pages[variables.page - 1];
    return typeof handler === 'function' ? handler() : handler;
  });

const renderDay = (filters) =>
  render(
    <MemoryRouter>
      <Day date={DATE} timeZone='utc' filters={filters} />
    </MemoryRouter>,
  );

afterEach(() => {
  clearScheduleCache();
  favoritesStore.reset();
});

describe('Day', () => {
  it('shows saved episodes with a notice when AniList cannot be reached', async () => {
    writePersistent(
      `schedule:${RANGE.start}:${RANGE.end}:1`,
      { items: [makeItem(1, 'Saved Show')], hasNextPage: false },
      Date.now() - 2 * 60 * 60 * 1000,
    );
    mockAnilist(({ name, variables }) =>
      name === 'Schedule' && variables.start === RANGE.start
        ? graphQLError(400, 'Service down')
        : page([], 1, false),
    );
    renderDay();

    expect(await screen.findByText(/AniList could not be reached/)).toBeInTheDocument();
    expect(screen.getAllByText('Saved Show').length).toBeGreaterThan(0);
  });

  it('loads the next page when more episodes are requested', async () => {
    serveDay([
      page([makeItem(1, 'First Show'), makeItem(9, 'Adult Show', [], true)], 1, true),
      page([makeItem(2, 'Second Show')], 2, false),
    ]);
    renderDay();

    expect(
      await screen.findByRole('heading', { name: 'First Show', level: 2 }),
    ).toBeInTheDocument();
    // Adult titles are always shown.
    expect(screen.getByRole('heading', { name: 'Adult Show', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('2+ episodes airing on this day')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load more episodes' }));

    expect(
      await screen.findByRole('heading', { name: 'Second Show', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 episodes airing on this day')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more episodes' })).not.toBeInTheDocument();
  });

  it('shows skeleton cards while the first page loads', async () => {
    serveDay([page([makeItem(1, 'First Show')], 1, false)]);
    renderDay();
    expect(screen.getByLabelText('Loading schedule')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'First Show', level: 2 }),
    ).toBeInTheDocument();
  });

  it('applies search, genre and favorite filters', async () => {
    const items = [makeItem(1, 'Frieren', ['Fantasy']), makeItem(2, 'Dandadan', ['Action'])];
    serveDay([page(items, 1, false)]);

    const { unmount } = renderDay({ query: 'frie', genre: '', favoritesOnly: false, active: true });
    expect(await screen.findByRole('heading', { name: 'Frieren', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dandadan', level: 2 })).not.toBeInTheDocument();
    expect(screen.getByText('1 of 2 episodes match your filters')).toBeInTheDocument();
    unmount();

    favoritesStore.set({ 2: { id: 2, title: 'Dandadan' } });
    renderDay({ query: '', genre: 'Action', favoritesOnly: true, active: true });
    const heading = await screen.findByRole('heading', { name: 'Dandadan', level: 2 });
    const card = heading.closest('article');
    expect(within(card).getByRole('button', { name: 'Favorite Dandadan' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('heading', { name: 'Frieren', level: 2 })).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing airs', async () => {
    serveDay([page([], 1, false)]);
    renderDay();
    expect(await screen.findByText('No episodes are scheduled for this day.')).toBeInTheDocument();
  });

  it('lets the user retry after an error', async () => {
    let calls = 0;
    serveDay([
      () => {
        calls += 1;
        return calls === 1
          ? graphQLError(400, 'Invalid query')
          : page([makeItem(3, 'Recovered Show')], 1, false);
      },
    ]);
    renderDay();

    expect(await screen.findByText('Invalid query')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'Recovered Show', level: 2 }),
    ).toBeInTheDocument();
  });
});
