import { useEffect, useSyncExternalStore } from 'react';
import { gql, useApolloClient } from '@apollo/client';
import { createStorageStore } from './storage';
import { favoritesStore, getFavorites } from './favorites';
import { toIsoDate } from './globals';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;
// Releases older than this are marked as seen without a notification.
const MAX_LATE_NOTIFICATION_MS = 3 * 24 * 60 * 60 * 1000;
const DEFAULT_ICON = '/icons/icon-192.png';

export const notifySettingStore = createStorageStore('aotd:notify', false);
export const releaseTrackerStore = createStorageStore('aotd:release-tracker', {});

export const FAVORITE_EPISODES_QUERY = gql`
  query FavoriteNextEpisodes($ids: [Int], $perPage: Int) {
    Page(perPage: $perPage) {
      media(id_in: $ids) {
        id
        title {
          userPreferred
        }
        coverImage {
          medium
        }
        nextAiringEpisode {
          episode
          airingAt
        }
      }
    }
  }
`;

export const isNotificationSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

const permissionListeners = new Set();
const emitPermissionChange = () => permissionListeners.forEach((listener) => listener());

const getPermission = () => (isNotificationSupported() ? Notification.permission : 'unsupported');

const subscribePermission = (listener) => {
  permissionListeners.add(listener);
  let status = null;
  navigator.permissions
    ?.query?.({ name: 'notifications' })
    .then((result) => {
      status = result;
      status.onchange = emitPermissionChange;
    })
    .catch(() => {});
  return () => {
    permissionListeners.delete(listener);
    if (status) status.onchange = null;
  };
};

export function useNotificationStatus() {
  const enabledSetting = notifySettingStore.useValue();
  const permission = useSyncExternalStore(subscribePermission, getPermission, () => 'default');
  return {
    supported: permission !== 'unsupported',
    permission,
    enabled: Boolean(enabledSetting) && permission === 'granted',
  };
}

export async function enableNotifications() {
  if (!isNotificationSupported()) return 'unsupported';
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  notifySettingStore.set(permission === 'granted');
  emitPermissionChange();
  return permission;
}

export function disableNotifications() {
  notifySettingStore.set(false);
}

async function showNotification(title, options) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Fall back to the page level Notification API below.
  }
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      if (options?.data?.url) window.location.assign(options.data.url);
    };
  } catch {
    // Some browsers (Android Chrome) only allow notifications through a service worker.
  }
}

// Notifies about tracked episodes of favorites whose airing time has passed.
export function checkReleases(now = Date.now(), notify = showNotification) {
  const tracker = releaseTrackerStore.get() ?? {};
  const favorites = getFavorites();
  let changed = false;
  const next = { ...tracker };

  Object.entries(tracker).forEach(([id, entry]) => {
    if (!favorites[id] || entry.notified || entry.airingAt * 1000 > now) return;
    if (now - entry.airingAt * 1000 <= MAX_LATE_NOTIFICATION_MS) {
      notify(entry.title, {
        body: `Episode ${entry.episode} is out now!`,
        icon: entry.image || DEFAULT_ICON,
        badge: DEFAULT_ICON,
        tag: `aotd-${id}-${entry.episode}`,
        data: { url: `/${toIsoDate(new Date(entry.airingAt * 1000))}/${id}` },
      });
    }
    next[id] = { ...entry, notified: true };
    changed = true;
  });

  if (changed) releaseTrackerStore.set(next);
}

// Fetches the next episode of every favorite and stores it in the release tracker.
export async function refreshReleaseTracker(client, now = Date.now(), notify = showNotification) {
  const ids = Object.keys(getFavorites()).map(Number).filter(Number.isInteger);
  checkReleases(now, notify);
  if (ids.length === 0) return;

  const { data } = await client.query({
    query: FAVORITE_EPISODES_QUERY,
    variables: { ids, perPage: 50 },
    fetchPolicy: 'network-only',
  });

  const tracker = { ...(releaseTrackerStore.get() ?? {}) };
  (data?.Page?.media ?? []).forEach((media) => {
    const upcoming = media.nextAiringEpisode;
    const previous = tracker[media.id];
    if (!upcoming) {
      if (previous?.notified) delete tracker[media.id];
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
    tracker[media.id] = {
      episode: upcoming.episode,
      airingAt: upcoming.airingAt,
      title: media.title?.userPreferred ?? 'New episode',
      image: media.coverImage?.medium ?? null,
      notified: false,
    };
  });

  Object.keys(tracker).forEach((id) => {
    if (!ids.includes(Number(id))) delete tracker[id];
  });

  releaseTrackerStore.set(tracker);
}

// Keeps release notifications running while the app is open in any tab.
// Notifications with the browser fully closed would need a push server.
export function useReleaseNotifications() {
  const client = useApolloClient();
  const { enabled } = useNotificationStatus();
  const favorites = favoritesStore.useValue();

  useEffect(() => {
    if (!enabled) return undefined;
    const refresh = () => refreshReleaseTracker(client).catch(() => {});
    refresh();
    const refreshId = setInterval(refresh, REFRESH_INTERVAL_MS);
    const checkId = setInterval(() => checkReleases(), CHECK_INTERVAL_MS);
    return () => {
      clearInterval(refreshId);
      clearInterval(checkId);
    };
  }, [client, enabled, favorites]);
}
