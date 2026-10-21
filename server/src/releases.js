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

// Returns the notifications to send now and the tracker with those marked as sent.
export function findReleases(tracker, now) {
  const releases = [];
  const next = { ...tracker };

  Object.entries(tracker).forEach(([id, entry]) => {
    if (entry.notified || entry.airingAt * 1000 > now) return;
    if (now - entry.airingAt * 1000 <= MAX_LATE_NOTIFICATION_MS) {
      releases.push({
        mediaId: Number(id),
        payload: {
          title: entry.title,
          body: `Episode ${entry.episode} is out now!`,
          icon: entry.image || '/icons/icon-192.png',
          tag: `aotd-${id}-${entry.episode}`,
          url: `/${toIsoDate(entry.airingAt)}/${id}`,
        },
      });
    }
    next[id] = { ...entry, notified: true };
  });

  return { releases, tracker: next };
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
