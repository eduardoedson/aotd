// Minimal GraphQL client for AniList with retries. It replaces Apollo Client,
// which was most of the bundle while the app only runs a handful of queries.

export const ANILIST_URL = 'https://graphql.anilist.co';

const MAX_ATTEMPTS = 3;
const MAX_DELAY_MS = 8000;
const MAX_RETRY_AFTER_MS = 60000;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export class AnilistError extends Error {
  status: number | undefined;
  retryAfterMs: number | null;

  constructor(message: string, status?: number, retryAfterMs: number | null = null) {
    super(message);
    this.name = 'AnilistError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

interface ErrorLike {
  status?: number;
  retryAfterMs?: number | null;
  name?: string;
}

// Retries network failures, rate limits and server errors, but never client errors
// such as 400 (invalid query) or 404 (media not found).
export const isRetryableError = (error: unknown) => {
  if (!error) return false;
  const { status, name } = error as ErrorLike;
  if (name === 'AbortError') return false;
  if (status === undefined) return true;
  return RETRYABLE_STATUS.has(status);
};

// Parses the Retry-After header (seconds or HTTP date) that AniList sends with 429 responses.
export const parseRetryAfter = (header: string | null, now = Date.now()) => {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
};

export const getRetryDelay = (attempt: number, error: unknown, random = Math.random) => {
  const retryAfter = (error as ErrorLike | undefined)?.retryAfterMs ?? null;
  if (retryAfter !== null) return Math.min(retryAfter, MAX_RETRY_AFTER_MS);
  const base = Math.min(1000 * 2 ** (attempt - 1), MAX_DELAY_MS);
  return base / 2 + random() * (base / 2);
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string; status?: number }[];
}

async function requestOnce<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal,
  });

  let body: GraphQLResponse<T> | null;
  try {
    body = (await response.json()) as GraphQLResponse<T>;
  } catch {
    body = null;
  }

  const firstError = body?.errors?.[0];
  if (!response.ok) {
    throw new AnilistError(
      firstError?.message ?? `AniList request failed with status ${response.status}`,
      response.status,
      parseRetryAfter(response.headers.get('Retry-After')),
    );
  }
  if (!body?.data) {
    throw new AnilistError(firstError?.message ?? 'AniList returned no data', firstError?.status);
  }
  return body.data;
}

export async function anilistRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<T> {
  let attempt = 1;
  for (;;) {
    try {
      return await requestOnce<T>(query, variables, signal);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isRetryableError(error)) throw error;
      await sleep(getRetryDelay(attempt, error), signal);
      attempt += 1;
    }
  }
}

export const getErrorStatus = (error: unknown) => (error as ErrorLike | null)?.status;
