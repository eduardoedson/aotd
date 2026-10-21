import { describe, expect, it } from 'vitest';
import { getHttpStatus, getRetryAfterMs, getRetryDelay, isRetryableError } from './backend';

const httpError = (status, headers = {}) =>
  Object.assign(new Error(`status ${status}`), {
    statusCode: status,
    response: { status, headers: new Headers(headers) },
  });

describe('retry policy', () => {
  it('retries network failures, rate limits and server errors only', () => {
    expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRetryableError(httpError(429))).toBe(true);
    expect(isRetryableError(httpError(503))).toBe(true);
    expect(isRetryableError(httpError(400))).toBe(false);
    expect(isRetryableError(httpError(404))).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });

  it('respects the Retry-After header', () => {
    expect(getRetryAfterMs(httpError(429, { 'Retry-After': '7' }))).toBe(7000);
    expect(getRetryDelay(1, httpError(429, { 'Retry-After': '120' }))).toBe(60000);
    const now = Date.parse('2026-10-21T10:00:00Z');
    expect(
      getRetryAfterMs(httpError(429, { 'Retry-After': 'Wed, 21 Oct 2026 10:00:05 GMT' }), now),
    ).toBe(5000);
  });

  it('uses exponential backoff with jitter', () => {
    expect(getRetryDelay(1, httpError(500), () => 0)).toBe(500);
    expect(getRetryDelay(3, httpError(500), () => 1)).toBe(4000);
    expect(getRetryDelay(10, httpError(500), () => 1)).toBe(8000);
  });

  it('reads the HTTP status from Apollo errors', () => {
    expect(getHttpStatus({ networkError: { statusCode: 404 } })).toBe(404);
  });
});
