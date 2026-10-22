// Release tracking shared logic: which favorites have a new episode out, and what
// to remember about the next one.

export const MAX_LATE_NOTIFICATION_MS = 3 * 24 * 60 * 60 * 1000;
const ANILIST_URL = 'https://graphql.anilist.co';
const CHUNK_SIZE = 50;

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
  const releases = [];
  const next = { ...tracker };
  let changed = false;

  Object.entries(tracker).forEach(([id, entry]) => {
    if (entry.notified || entry.airingAt * 1000 > now) return;
    if (now - entry.airingAt * 1000 <= MAX_LATE_NOTIFICATION_MS) {
      releases.push({
        mediaId: Number(id),
        episode: entry.episode,
        payload: {
          title: entry.title,
          body: `Episode ${entry.episode} is out now!`,
          icon: entry.image || '/icons/icon-192.png',
          tag: releaseTag(id, entry.episode),
          url: `/${toIsoDate(entry.airingAt)}/${id}`,
        },
      });
      return;
    }
    next[id] = { ...entry, notified: true };
    changed = true;
  });

  return { releases, tracker: next, changed };
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
export function updateTracker(tracker, mediaList, trackedIds, now) {
  const next = { ...tracker };

  mediaList.forEach((media) => {
    const upcoming = media.nextAiringEpisode;
    const previous = next[media.id];
    if (!upcoming) {
      if (previous?.notified) delete next[media.id];
      return;
    }
    if (
      previous &&
      previous.episode === upcoming.episode &&
      previous.airingAt === upcoming.airingAt
    ) {
      return;
    }
    // Keep an aired but not yet announced episode until it has been sent.
    if (previous && !previous.notified && previous.airingAt * 1000 <= now) return;
    next[media.id] = {
      episode: upcoming.episode,
      airingAt: upcoming.airingAt,
      title: media.title?.userPreferred ?? 'New episode',
      image: media.coverImage?.medium ?? null,
      notified: false,
    };
  });

  const wanted = new Set(trackedIds.map(String));
  Object.keys(next).forEach((id) => {
    if (!wanted.has(id)) delete next[id];
  });

  return next;
}

export async function fetchNextEpisodes(ids, fetchImpl = fetch) {
  const media = [];
  for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
    const chunk = ids.slice(index, index + CHUNK_SIZE);
    const response = await fetchImpl(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { ids: chunk, perPage: CHUNK_SIZE } }),
    });
    if (!response.ok) throw new Error(`AniList answered ${response.status}`);
    const body = await response.json();
    media.push(...(body?.data?.Page?.media ?? []));
  }
  return media;
}
