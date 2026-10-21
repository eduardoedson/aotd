import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AnilistError,
  anilistRequest,
  describeAnilistError,
  getRetryDelay,
  isRetryableError,
  parseRetryAfter,
} from './anilist';

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('retry policy', () => {
  it('retries network failures, rate limits and server errors only', () => {
    expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRetryableError(new AnilistError('rate', 429))).toBe(true);
    expect(isRetryableError(new AnilistError('down', 503))).toBe(true);
    expect(isRetryableError(new AnilistError('bad', 400))).toBe(false);
    expect(isRetryableError(new AnilistError('missing', 404))).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });

  it('parses the Retry-After header', () => {
    expect(parseRetryAfter('7')).toBe(7000);
    const now = Date.parse('2026-10-21T10:00:00Z');
    expect(parseRetryAfter('Wed, 21 Oct 2026 10:00:05 GMT', now)).toBe(5000);
    expect(parseRetryAfter(null)).toBeNull();
  });

  it('uses Retry-After first, then exponential backoff with jitter', () => {
    expect(getRetryDelay(1, new AnilistError('rate', 429, 120000))).toBe(60000);
    expect(getRetryDelay(1, new AnilistError('down', 500), () => 0)).toBe(500);
    expect(getRetryDelay(3, new AnilistError('down', 500), () => 1)).toBe(4000);
    expect(getRetryDelay(10, new AnilistError('down', 500), () => 1)).toBe(8000);
  });
});

describe('anilistRequest', () => {
  it('returns the data of a successful response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { Media: { id: 1 } } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(anilistRequest('query X { a }', { id: 1 })).resolves.toEqual({ Media: { id: 1 } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ query: 'query X { a }', variables: { id: 1 } });
  });

  it('does not retry client errors and keeps the status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: null, errors: [{ message: 'Not Found.' }] }, 404));
    vi.stubGlobal('fetch', fetchMock);

    await expect(anilistRequest('query X { a }')).rejects.toMatchObject({
      message: 'Not Found.',
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a rate limited request after Retry-After', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ errors: [{ message: 'Too Many Requests.' }] }, 429, { 'Retry-After': '2' }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = anilistRequest('query X { a }');
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('describeAnilistError', () => {
  it('explains a blocked or unreachable API instead of "Failed to fetch"', () => {
    expect(describeAnilistError(new TypeError('Failed to fetch'))).toMatch(
      /AniList is unavailable/,
    );
  });

  it('recognises the disabled API message', () => {
    const error = new AnilistError(
      'The AniList API has been temporarily disabled due to severe stability issues.',
      403,
    );
    expect(describeAnilistError(error)).toBe(
      'AniList has temporarily disabled its API. Please try again later.',
    );
  });

  it('maps rate limits and server errors', () => {
    expect(describeAnilistError(new AnilistError('x', 429))).toMatch(/Too many requests/);
    expect(describeAnilistError(new AnilistError('x', 503))).toMatch(/having problems/);
  });

  it('keeps other messages as they are', () => {
    expect(describeAnilistError(new AnilistError('Not Found.', 404))).toBe('Not Found.');
  });
});
