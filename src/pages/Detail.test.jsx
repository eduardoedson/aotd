import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Detail from './Detail';
import { DETAIL_QUERY } from '../services/detail';

const media = {
  __typename: 'Media',
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
    __typename: 'MediaTitle',
    romaji: 'Sousou no Frieren',
    english: 'Frieren: Beyond Journey’s End',
    native: '葬送のフリーレン',
    userPreferred: 'Sousou no Frieren',
  },
  startDate: { __typename: 'FuzzyDate', year: 2023, month: 9, day: 29 },
  endDate: { __typename: 'FuzzyDate', year: null, month: null, day: null },
  nextAiringEpisode: null,
  trailer: { __typename: 'MediaTrailer', id: 'abc_123', site: 'youtube' },
  coverImage: {
    __typename: 'MediaCoverImage',
    extraLarge: 'https://s4.anilist.co/cover.jpg',
    color: '#e4a15d',
  },
  tags: [{ __typename: 'MediaTag', id: 5, name: 'Elf' }],
  characters: {
    __typename: 'CharacterConnection',
    nodes: [
      {
        __typename: 'Character',
        id: 7,
        name: { __typename: 'CharacterName', userPreferred: 'Frieren' },
        image: { __typename: 'CharacterImage', medium: 'https://s4.anilist.co/c.jpg' },
      },
    ],
  },
  studios: {
    __typename: 'StudioConnection',
    nodes: [{ __typename: 'Studio', id: 11, name: 'Madhouse' }],
  },
  externalLinks: [
    {
      __typename: 'MediaExternalLink',
      id: 1,
      url: 'https://www.crunchyroll.com/frieren',
      site: 'Crunchyroll',
    },
    { __typename: 'MediaExternalLink', id: 2, url: 'javascript:alert(1)', site: 'Evil' },
  ],
};

const renderDetail = (mocks, path = '/2026-10-21/1') =>
  render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path='/:date/:id' element={<Detail />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );

describe('Detail', () => {
  it('renders sanitized media information', async () => {
    renderDetail([
      {
        request: { query: DETAIL_QUERY, variables: { id: 1 } },
        result: { data: { Media: media } },
      },
    ]);

    expect(
      await screen.findByRole('heading', { name: 'Sousou no Frieren', level: 1 }),
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
    expect(document.title).toBe('Sousou no Frieren :: AOTD');
  });

  it('shows a not found message for a 404 response', async () => {
    const notFound = Object.assign(new Error('Response not successful: Received status code 404'), {
      statusCode: 404,
    });
    renderDetail([{ request: { query: DETAIL_QUERY, variables: { id: 1 } }, error: notFound }]);

    expect(await screen.findByText('Item Not Found!')).toBeInTheDocument();
  });

  it('validates the route parameters', () => {
    renderDetail([], '/2026-10-21/abc');
    expect(screen.getByText('Invalid item ID!')).toBeInTheDocument();
  });
});
