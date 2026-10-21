import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { RetryLink } from '@apollo/client/link/retry';

const MAX_ATTEMPTS = 3;
const MAX_DELAY_MS = 8000;
const MAX_RETRY_AFTER_MS = 60000;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const getStatus = (error) => error?.statusCode ?? error?.response?.status;

// Retries network failures, rate limits and server errors, but never client errors
// such as 400 (invalid query) or 404 (media not found).
export const isRetryableError = (error) => {
  if (!error) return false;
  const status = getStatus(error);
  if (status === undefined) return true;
  return RETRYABLE_STATUS.has(status);
};

// Reads the Retry-After header (seconds or HTTP date) that AniList sends with 429 responses.
export const getRetryAfterMs = (error, now = Date.now()) => {
  const header = error?.response?.headers?.get?.('Retry-After');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
};

export const getRetryDelay = (attempt, error, random = Math.random) => {
  const retryAfter = getRetryAfterMs(error);
  if (retryAfter !== null) return Math.min(retryAfter, MAX_RETRY_AFTER_MS);
  const base = Math.min(1000 * 2 ** (attempt - 1), MAX_DELAY_MS);
  return base / 2 + random() * (base / 2);
};

const retryLink = new RetryLink({
  delay: (attempt, _operation, error) => getRetryDelay(attempt, error),
  attempts: {
    max: MAX_ATTEMPTS,
    retryIf: (error) => isRetryableError(error),
  },
});

const httpLink = new HttpLink({
  uri: 'https://graphql.anilist.co',
  headers: {
    Accept: 'application/json',
  },
});

export const anilist = new ApolloClient({
  link: retryLink.concat(httpLink),
  cache: new InMemoryCache(),
});

// Apollo wraps HTTP failures, so this reads the status code wherever it ended up.
export const getHttpStatus = (error) =>
  error?.networkError?.statusCode ?? error?.networkError?.response?.status ?? getStatus(error);
