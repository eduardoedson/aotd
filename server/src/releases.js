// Push server release logic: which favorites have a new episode out, delivery to
// each browser and the AniList lookups. The tracking rules themselves live in
// shared/releaseTracker.js, which the browser uses too.

import {
  chunk,
  collectDueReleases,
  MAX_LATE_NOTIFICATION_MS,
  MEDIA_BATCH_SIZE,
  mergeNextEpisodes,
} from '../../shared/releaseTracker.js';

export { MAX_LATE_NOTIFICATION_MS };

const ANILIST_URL = 'https://graphql.anilist.co';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 3;
const MAX_RETRY_AFTER_MS = 60000;

const QUERY = `
  query FavoriteNextEpisodes($ids: [Int], $perPage: Int) {
    Page(perPage: $perPage) {
      media(id_in: $ids) {
        id
        title { userPreferred }
        coverImage { medium }
        nextAiringEpisode { episode airingAt }
      }
    }
  }
`;

export function collectMediaIds(subscriptions) {
  const ids = new Set();
  Object.values(subscriptions).forEach((entry) => entry.mediaIds.forEach((id) => ids.add(id)));
  return [...ids];
}

const toIsoDate = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10);

// A delivered tag is remembered a little longer than the late window, so a
// retry can never send the same episode twice to one browser.
export const SENT_RETENTION_MS = MAX_LATE_NOTIFICATION_MS + 24 * 60 * 60 * 1000;

const releaseTag = (id, episode) => `aotd-${id}-${episode}`;

// Returns the releases still waiting for delivery. Nothing is marked as sent
// here: only releases older than the late window are closed, without a
// notification. Delivery results are applied later by applyDeliveries.
export function findReleases(tracker, now) {
  const { due, expired } = collectDueReleases(tracker, now);
  const next = { ...tracker };
  expired.forEach((id) => {
    next[id] = { ...tracker[id], notified: true };
  });

  const releases = due.map(({ id, entry }) => ({
    mediaId: Number(id),
    episode: entry.episode,
    payload: {
      title: entry.title,
      body: `Episode ${entry.episode} is out now!`,
      icon: entry.image || '/icons/icon-192.png',
      tag: releaseTag(id, entry.episode),
      url: `/${toIsoDate(entry.airingAt)}/${id}`,
    },
  }));

  return { releases, tracker: next, changed: expired.length > 0 };
}

// 404 and 410 mean the browser dropped the subscription for good.
export const isGoneError = (error) => error?.statusCode === 404 || error?.statusCode === 410;

// Network errors, rate limits and server errors are worth another attempt. Any
// other client error (bad payload, wrong VAPID keys) would fail again.
export const isTransientError = (error) => {
  const status = error?.statusCode;
  return typeof status !== 'number' || status === 429 || status >= 500;
};

// Sends every pending release to the subscriptions that follow it and have not
// received it yet. Returns what happened so the caller can persist it.
export async function deliverReleases(releases, subscriptions, send) {
  const delivered = [];
  const gone = new Set();
  const retry = new Set();
  const failures = [];
  const tasks = [];

  Object.entries(subscriptions).forEach(([endpoint, entry]) => {
    releases
      .filter((release) => entry.mediaIds.includes(release.mediaId))
      .filter((release) => !entry.sent?.[release.payload.tag])
      .forEach((release) => {
        const { tag } = release.payload;
        tasks.push(
          send(entry.subscription, release.payload).then(
            () => {
              delivered.push({ endpoint, tag });
            },
            (error) => {
              if (isGoneError(error)) {
                gone.add(endpoint);
                return;
              }
              failures.push({ endpoint, tag, status: error?.statusCode ?? error?.message });
              if (isTransientError(error)) {
                retry.add(tag);
                return;
              }
              // Permanent failure for this message: record it so it is not retried.
              delivered.push({ endpoint, tag });
            },
          ),
        );
      });
  });

  await Promise.all(tasks);

  const completed = releases
    .filter((release) => !retry.has(release.payload.tag))
    .map((release) => ({ mediaId: release.mediaId, episode: release.episode }));

  return { delivered, gone: [...gone], completed, failures, attempted: tasks.length };
}

// Applies a delivery result to the stored data. It reads the current data, so
// subscriptions or tracker entries changed while sending are respected.
export function applyDeliveries(data, result, now) {
  result.delivered.forEach(({ endpoint, tag }) => {
    const entry = data.subscriptions[endpoint];
    if (!entry) return;
    entry.sent = { ...(entry.sent ?? {}), [tag]: now };
  });

  result.gone.forEach((endpoint) => {
    delete data.subscriptions[endpoint];
  });

  result.completed.forEach(({ mediaId, episode }) => {
    const entry = data.tracker[mediaId];
    if (entry && entry.episode === episode) data.tracker[mediaId] = { ...entry, notified: true };
  });

  Object.values(data.subscriptions).forEach((entry) => {
    if (!entry.sent) return;
    Object.entries(entry.sent).forEach(([tag, sentAt]) => {
      if (now - sentAt > SENT_RETENTION_MS) delete entry.sent[tag];
    });
  });

  return data;
}

// Merges fresh "next episode" data from AniList into the tracker.
export const updateTracker = mergeNextEpisodes;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfter = (header) => {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
};

const isRetryableStatus = (status) => status === 429 || status === 408 || status >= 500;

const backoff = (attempt) => Math.min(1000 * 2 ** (attempt - 1), 8000);

// One AniList page request with a timeout. Rate limits (429), server errors,
// timeouts and network failures are retried, honouring Retry-After when AniList
// sends it. Other client errors fail at once.
async function requestBatch(ids, { fetchImpl, sleep, timeoutMs, maxAttempts }) {
  for (let attempt = 1; ; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(ANILIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { ids, perPage: MEDIA_BATCH_SIZE } }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      await sleep(backoff(attempt));
      continue;
    }

    if (response.ok) {
      const body = await response.json();
      return body?.data?.Page?.media ?? [];
    }
    if (!isRetryableStatus(response.status) || attempt >= maxAttempts) {
      throw new Error(`AniList answered ${response.status}`);
    }
    const retryAfter = parseRetryAfter(response.headers?.get?.('Retry-After') ?? null);
    await sleep(Math.min(retryAfter ?? backoff(attempt), MAX_RETRY_AFTER_MS));
  }
}

export async function fetchNextEpisodes(
  ids,
  fetchImpl = fetch,
  { sleep = wait, timeoutMs = REQUEST_TIMEOUT_MS, maxAttempts = MAX_ATTEMPTS } = {},
) {
  const media = [];
  for (const batch of chunk(ids)) {
    media.push(...(await requestBatch(batch, { fetchImpl, sleep, timeoutMs, maxAttempts })));
  }
  return media;
}
