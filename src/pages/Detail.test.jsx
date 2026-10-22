import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Detail from './Detail';
import { clearQueryCache } from '../services/useAnilistQuery';
import { graphQLError, mockAnilist } from '../test/anilistMock';

const media = {
  id: 1,
  type: 'ANIME',
  status: 'RELEASING',
  description: 'A <b>great</b> show<script>alert(1)</script>',
  siteUrl: 'https://anilist.co/anime/1',
  episodes: 12,
  chapters: null,
  duration: 24,
  source: 'LIGHT_NOVEL',
  genres: ['Fantasy'],
  synonyms: ['Frieren at the Funeral'],
  averageScore: 90,
  title: {
    romaji: 'Sousou no Frieren',
    english: 'Frieren: Beyond Journey’s End',
    native: '葬送のフリーレン',
    userPreferred: 'Sousou no Frieren',
  },
  startDate: { year: 2023, month: 9, day: 29 },
  endDate: { year: null, month: null, day: null },
  nextAiringEpisode: null,
  trailer: { id: 'abc_123', site: 'youtube' },
  coverImage: { extraLarge: 'https://s4.anilist.co/cover.jpg', color: '#e4a15d' },
  tags: [{ id: 5, name: 'Elf' }],
  characters: {
    nodes: [
      {
        id: 7,
        name: { userPreferred: 'Frieren' },
        image: { medium: 'https://s4.anilist.co/c.jpg' },
      },
    ],
  },
  studios: { nodes: [{ id: 11, name: 'Madhouse' }] },
  externalLinks: [
    { id: 1, url: 'https://www.crunchyroll.com/frieren', site: 'Crunchyroll' },
    { id: 2, url: 'javascript:alert(1)', site: 'Evil' },
  ],
};

const renderDetail = (path = '/2026-10-21/1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path='/:date/:id' element={<Detail />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => clearQueryCache());

describe('Detail', () => {
  it('renders sanitized media information', async () => {
    mockAnilist(({ name, variables }) =>
      name === 'MediaDetail' && variables.id === 1 ? { data: { Media: media } } : undefined,
    );
    renderDetail();

    expect(screen.getByLabelText('Loading details')).toBeInTheDocument();
    expect(
      // A longer wait keeps this heavy page stable when the whole suite runs in parallel.
      await screen.findByRole(
        'heading',
        { name: 'Sousou no Frieren', level: 1 },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Rated 4.5 out of 5/ })).toBeInTheDocument();
    expect(screen.getByText('Frieren: Beyond Journey’s End')).toBeInTheDocument();
    expect(screen.getByText('Light Novel')).toBeInTheDocument();
    expect(screen.getByText('Madhouse')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crunchyroll' })).toHaveAttribute(
      'href',
      'https://www.crunchyroll.com/frieren',
    );
    expect(screen.queryByRole('link', { name: 'Evil' })).not.toBeInTheDocument();
    expect(document.querySelector('.detail-description script')).toBeNull();
    expect(screen.getByTitle('Sousou no Frieren trailer')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/abc_123',
    );
    expect(screen.getByRole('link', { name: /Back to schedule/ })).toHaveAttribute(
      'href',
      '/2026-10-21',
    );
    // The title is set in an effect, which may run a moment after the heading appears.
    await waitFor(() => expect(document.title).toBe('Sousou no Frieren :: AOTD'));
  });

  it('copies the link when the share sheet is not available', async () => {
    mockAnilist(() => ({ data: { Media: media } }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Share' }));
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it('shows a not found message for a 404 response', async () => {
    mockAnilist(() => graphQLError(404, 'Not Found.'));
    renderDetail();

    expect(await screen.findByText('Item Not Found!')).toBeInTheDocument();
  });

  it('validates the route parameters', () => {
    renderDetail('/2026-10-21/abc');
    expect(screen.getByText('Invalid item ID!')).toBeInTheDocument();
  });
});
