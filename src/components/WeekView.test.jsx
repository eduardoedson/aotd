import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import WeekView from './WeekView';
import { clearScheduleCache } from '../services/schedule';
import { mockAnilist } from '../test/anilistMock';

const item = (id, title, isoDateTime) => ({
  id,
  episode: id,
  airingAt: Date.parse(isoDateTime) / 1000,
  media: {
    id: id + 100,
    isAdult: false,
    siteUrl: null,
    duration: 24,
    genres: ['Action'],
    description: null,
    title: { userPreferred: title, romaji: title, english: null },
    coverImage: { extraLarge: null, color: null },
    externalLinks: [],
  },
});

afterEach(() => clearScheduleCache());

describe('WeekView', () => {
  it('loads every page of the week and groups episodes by day', async () => {
    const fetchMock = mockAnilist(({ variables }) => ({
      data: {
        Page: {
          pageInfo: { currentPage: variables.page, hasNextPage: variables.page === 1 },
          airingSchedules:
            variables.page === 1
              ? [item(1, 'Monday Show', '2026-10-19T10:00:00Z')]
              : [item(2, 'Sunday Show', '2026-10-25T22:30:00Z')],
        },
      },
    }));

    render(
      <MemoryRouter initialEntries={['/2026-10-21?view=week']}>
        <WeekView date='2026-10-21' timeZone='utc' />
      </MemoryRouter>,
    );

    expect(await screen.findByText('2 episodes this week')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const monday = screen.getByRole('link', { name: /Mon\s*Oct 19/ }).closest('.week-column');
    expect(within(monday).getByText('Monday Show')).toBeInTheDocument();
    expect(within(monday).getByText('10:00')).toBeInTheDocument();

    const sunday = screen.getByRole('link', { name: /Sun\s*Oct 25/ }).closest('.week-column');
    expect(within(sunday).getByText('Sunday Show')).toBeInTheDocument();
    expect(within(sunday).getByRole('link', { name: /Sunday Show/ })).toHaveAttribute(
      'href',
      '/2026-10-25/102',
    );
  });
});
