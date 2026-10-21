import { describe, expect, it } from 'vitest';
import { buildEpisodeIcs, buildGoogleCalendarUrl, slugify } from './calendarExport';

describe('buildEpisodeIcs', () => {
  it('creates a valid event with escaped text and an alarm', () => {
    const ics = buildEpisodeIcs({
      mediaId: 42,
      title: 'Re:Zero, Season 3; Part 2',
      episode: 5,
      airingAt: Date.UTC(2026, 9, 21, 15, 30) / 1000,
      duration: 25,
      url: 'https://anilist.co/anime/42',
    });

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:aotd-42-5@aotd.eduardoalves.tech');
    expect(ics).toContain('DTSTART:20261021T153000Z');
    expect(ics).toContain('DTEND:20261021T155500Z');
    expect(ics).toContain('SUMMARY:Re:Zero\\, Season 3\\; Part 2 - Episode 5');
    expect(ics).toContain('TRIGGER:-PT10M');
    ics.split('\r\n').forEach((line) => expect(line.length).toBeLessThanOrEqual(75));
  });

  it('slugifies file names', () => {
    expect(slugify('Sousou no Frieren: Beyond!')).toBe('sousou-no-frieren-beyond');
    expect(slugify('')).toBe('episode');
  });

  it('builds a Google Calendar link with the event filled in', () => {
    const url = new URL(
      buildGoogleCalendarUrl({
        mediaId: 1,
        title: 'Frieren',
        episode: 3,
        airingAt: Date.UTC(2026, 9, 21, 15, 30) / 1000,
        duration: 24,
        url: 'https://anilist.co/anime/1',
      }),
    );
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Frieren - Episode 3');
    expect(url.searchParams.get('dates')).toBe('20261021T153000Z/20261021T155400Z');
  });
});
