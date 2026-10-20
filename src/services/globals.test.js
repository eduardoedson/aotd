import { describe, expect, it } from 'vitest';
import { getSafeExternalUrl, isValidDate } from './globals';

describe('isValidDate', () => {
  it('accepts real dates in YYYY-MM-DD format', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2026-10-20')).toBe(true);
  });

  it('rejects impossible or malformed dates', () => {
    expect(isValidDate('2023-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('20-10-2026')).toBe(false);
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
