import { describe, expect, it } from 'vitest';
import {
  formatLongDate,
  getDayRange,
  getSafeExternalUrl,
  humanizeEnum,
  isValidDate,
  isoToLocalDate,
  localDateToIso,
  normalizeSearch,
  shiftIsoDate,
  toPlainText,
  truncateText,
} from './globals';

describe('isValidDate', () => {
  it('accepts real dates in YYYY-MM-DD format', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2026-10-20')).toBe(true);
  });

  it('rejects impossible or malformed dates', () => {
    expect(isValidDate('2023-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('20-10-2026')).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe('getSafeExternalUrl', () => {
  it('allows HTTP and HTTPS URLs', () => {
    expect(getSafeExternalUrl('https://anilist.co/anime/1')).toBe('https://anilist.co/anime/1');
  });

  it('rejects unsafe and malformed URLs', () => {
    expect(getSafeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(getSafeExternalUrl('not-a-url')).toBeNull();
  });
});

describe('date helpers', () => {
  it('shifts dates across month and year boundaries', () => {
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftIsoDate('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('round trips between ISO strings and local dates', () => {
    expect(localDateToIso(isoToLocalDate('2026-10-21'))).toBe('2026-10-21');
  });

  it('formats a long date label', () => {
    expect(formatLongDate('2026-10-20')).toBe('Tuesday, 20 Oct 2026');
  });

  it('returns an AniList range that covers the whole UTC day', () => {
    const start = Date.UTC(2026, 9, 21) / 1000;
    expect(getDayRange('2026-10-21')).toEqual({ start: start - 1, end: start + 86400 });
  });
});

describe('text helpers', () => {
  it('extracts plain text and decodes entities', () => {
    expect(toPlainText('Tom &amp; Jerry<br>are <i>back</i>')).toBe('Tom & Jerry are back');
    expect(toPlainText('<img src=x onerror=alert(1)>safe')).toBe('safe');
  });

  it('truncates at a word boundary', () => {
    expect(truncateText('alpha beta gamma delta', 18)).toBe('alpha beta gamma…');
    expect(truncateText('short', 12)).toBe('short');
  });

  it('humanizes enums and normalizes searches', () => {
    expect(humanizeEnum('NOT_YET_RELEASED')).toBe('Not Yet Released');
    expect(normalizeSearch('  Pokémon ')).toBe('pokemon');
  });
});
