import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import Day from './Day';
import { PER_PAGE, SCHEDULE_QUERY, clearScheduleCache } from '../services/schedule';
import { favoritesStore } from '../services/favorites';
import { getDayRange } from '../services/globals';

const DATE = '2026-10-21';

const makeItem = (id, title, genres = ['Action'], isAdult = false) => ({
  __typename: 'AiringSchedule',
  id: id * 10,
  episode: id,
  airingAt: Date.UTC(2026, 9, 21, 12) / 1000,
  media: {
    __typename: 'Media',
    id,
    isAdult,
    siteUrl: `https://anilist.co/anime/${id}`,
    duration: 24,
    genres,
    description: `<b>${title}</b> description`,
    title: { __typename: 'MediaTitle', userPreferred: title, romaji: title, english: null },
    coverImage: {
      __typename: 'MediaCoverImage',
      extraLarge: `https://s4.anilist.co/${id}.jpg`,
      color: '#123456',
    },
    externalLinks: [],
  },
});

const pageMock = (date, page, items, hasNextPage) => {
  const { start, end } = getDayRange(date);
  return {
    request: { query: SCHEDULE_QUERY, variables: { start, end, page, perPage: PER_PAGE } },
    result: {
      data: {
        Page: {
          __typename: 'Page',
          pageInfo: { __typename: 'PageInfo', currentPage: page, hasNextPage },
          airingSchedules: items,
        },
      },
    },
  };
};

const neighbourMocks = [pageMock('2026-10-20', 1, [], false), pageMock('2026-10-22', 1, [], false)];

const renderDay = (mocks, filters) =>
  render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <Day date={DATE} filters={filters} />
      </MemoryRouter>
    </MockedProvider>,
  );

afterEach(() => {
  clearScheduleCache();
  favoritesStore.reset();
});

describe('Day', () => {
  it('loads the next page when more episodes are requested', async () => {
    renderDay([
      pageMock(DATE, 1, [makeItem(1, 'First Show'), makeItem(9, 'Adult Show', [], true)], true),
      pageMock(DATE, 2, [makeItem(2, 'Second Show')], false),
      ...neighbourMocks,
    ]);

    expect(
      await screen.findByRole('heading', { name: 'First Show', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Adult Show')).not.toBeInTheDocument();
    expect(screen.getByText('1+ episode airing on this day')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load more episodes' }));

    expect(
      await screen.findByRole('heading', { name: 'Second Show', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 episodes airing on this day')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more episodes' })).not.toBeInTheDocument();
  });

  it('applies search, genre and favorite filters', async () => {
    const items = [makeItem(1, 'Frieren', ['Fantasy']), makeItem(2, 'Dandadan', ['Action'])];
    const mocks = [pageMock(DATE, 1, items, false), ...neighbourMocks];

    const { unmount } = renderDay(mocks, {
      query: 'frie',
      genre: '',
      favoritesOnly: false,
      active: true,
    });
    expect(await screen.findByRole('heading', { name: 'Frieren', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dandadan', level: 2 })).not.toBeInTheDocument();
    expect(screen.getByText('1 of 2 episodes match your filters')).toBeInTheDocument();
    unmount();

    favoritesStore.set({ 2: { id: 2, title: 'Dandadan' } });
    renderDay(mocks, { query: '', genre: 'Action', favoritesOnly: true, active: true });
    const heading = await screen.findByRole('heading', { name: 'Dandadan', level: 2 });
    const card = heading.closest('article');
    expect(within(card).getByRole('button', { name: 'Favorite Dandadan' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('heading', { name: 'Frieren', level: 2 })).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing airs', async () => {
    renderDay([pageMock(DATE, 1, [], false), ...neighbourMocks]);
    expect(await screen.findByText('No episodes are scheduled for this day.')).toBeInTheDocument();
  });

  it('lets the user retry after an error', async () => {
    const { start, end } = getDayRange(DATE);
    renderDay([
      {
        request: { query: SCHEDULE_QUERY, variables: { start, end, page: 1, perPage: PER_PAGE } },
        error: new Error('Network down'),
      },
      pageMock(DATE, 1, [makeItem(3, 'Recovered Show')], false),
      ...neighbourMocks,
    ]);

    expect(await screen.findByText(/Network down/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'Recovered Show', level: 2 }),
    ).toBeInTheDocument();
  });
});
