// Release tracking rules shared by the browser (tab notifications) and the push
// server, so both always decide the same way which episode to announce.

/**
 * @typedef {object} TrackedRelease
 * @property {number} episode
 * @property {number} airingAt Unix time in seconds.
 * @property {string} title
 * @property {string | null} [image]
 * @property {boolean} notified
 */

/** @typedef {Record<string, TrackedRelease>} ReleaseTracker */

/**
 * @typedef {object} NextEpisodeMedia
 * @property {number} id
 * @property {{ userPreferred: string | null } | null} [title]
 * @property {{ medium: string | null } | null} [coverImage]
 * @property {{ episode: number, airingAt: number } | null} [nextAiringEpisode]
 */

// Releases older than this are closed without a notification.
export const MAX_LATE_NOTIFICATION_MS = 3 * 24 * 60 * 60 * 1000;

// AniList returns at most 50 media per page.
export const MEDIA_BATCH_SIZE = 50;

/**
 * Splits a list in chunks of the given size.
 * @template T
 * @param {T[]} items
 * @param {number} [size]
 * @returns {T[][]}
 */
export function chunk(items, size = MEDIA_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Finds the tracked episodes whose airing time has passed and are not announced yet.
 * "due" are recent enough to notify; "expired" are too old and only need closing.
 * @param {ReleaseTracker} tracker
 * @param {number} now Milliseconds.
 * @param {Set<string>} [onlyIds] Restricts the check to these media ids.
 * @returns {{ due: { id: string, entry: TrackedRelease }[], expired: string[] }}
 */
export function collectDueReleases(tracker, now, onlyIds) {
  /** @type {{ id: string, entry: TrackedRelease }[]} */
  const due = [];
  /** @type {string[]} */
  const expired = [];

  Object.entries(tracker).forEach(([id, entry]) => {
    if (onlyIds && !onlyIds.has(id)) return;
    if (entry.notified || entry.airingAt * 1000 > now) return;
    if (now - entry.airingAt * 1000 <= MAX_LATE_NOTIFICATION_MS) {
      due.push({ id, entry });
    } else {
      expired.push(id);
    }
  });

  return { due, expired };
}

/**
 * Merges fresh "next episode" data from AniList into the tracker and drops media
 * nobody follows anymore. An aired episode that was not announced yet is kept
 * until it has been sent.
 * @param {ReleaseTracker} tracker
 * @param {NextEpisodeMedia[]} mediaList
 * @param {number[]} trackedIds
 * @param {number} now Milliseconds.
 * @returns {ReleaseTracker}
 */
export function mergeNextEpisodes(tracker, mediaList, trackedIds, now) {
  /** @type {ReleaseTracker} */
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
