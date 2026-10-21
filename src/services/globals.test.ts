import { describe, expect, it } from 'vitest';
import {
  formatAiringTime,
  formatLongDate,
  formatTime,
  formatWeekRange,
  getDayRange,
  getRange,
  getSafeExternalUrl,
  getWeekDays,
  getWeekStart,
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
    expect(getSafeExternalUrl(null)).toBeNull();
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

  it('formats long dates and week ranges', () => {
    expect(formatLongDate('2026-10-20')).toBe('Tuesday, 20 Oct 2026');
    expect(formatWeekRange('2026-10-21')).toBe('Oct 19 - Oct 25, 2026');
  });

  it('finds the Monday based week of a date', () => {
    expect(getWeekStart('2026-10-25')).toBe('2026-10-19');
    expect(getWeekStart('2026-10-19')).toBe('2026-10-19');
    expect(getWeekDays('2026-12-30')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });

  it('returns AniList ranges that cover whole UTC days', () => {
    const start = Date.UTC(2026, 9, 21) / 1000;
    expect(getDayRange('2026-10-21')).toEqual({ start: start - 1, end: start + 86400 });
    expect(getRange('2026-10-19', 7, 'utc').end - getRange('2026-10-19', 7, 'utc').start).toBe(
      7 * 86400 + 1,
    );
  });

  it('builds local day ranges from local midnight', () => {
    const { start, end } = getDayRange('2026-10-21', 'local');
    expect(start + 1).toBe(new Date(2026, 9, 21).getTime() / 1000);
    expect(end).toBe(new Date(2026, 9, 22).getTime() / 1000);
  });

  it('formats airing times in UTC', () => {
    expect(formatAiringTime(Date.UTC(2026, 9, 21, 7, 5) / 1000, 'utc')).toBe('07:05');
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

  it('formats countdowns', () => {
    expect(formatTime(3661)).toBe('01h 01m 01s');
    expect(formatTime(90061)).toBe('1d 01h 01m 01s');
  });
});
