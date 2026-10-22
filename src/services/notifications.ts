import { useEffect, useSyncExternalStore } from 'react';
import { anilistRequest } from './anilist';
import { createStorageStore } from './storage';
import { favoritesStore, getNotifyIds } from './favorites';
import { toIsoDateInZone } from './globals';
import { getTimeZone } from './timezone';
import { FAVORITE_EPISODES_QUERY, type FavoriteEpisodesResponse } from './queries';
import {
  isPushSupported,
  pushActiveStore,
  subscribeToPush,
  syncPushFavorites,
  unsubscribeFromPush,
} from './push';
import {
  chunk,
  collectDueReleases,
  MEDIA_BATCH_SIZE,
  mergeNextEpisodes,
} from '../../shared/releaseTracker.js';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;
const PUSH_SYNC_DELAY_MS = 1500;
const DEFAULT_ICON = '/icons/icon-192.png';

export interface TrackedRelease {
  episode: number;
  airingAt: number;
  title: string;
  image?: string | null;
  notified: boolean;
}

export type ReleaseTracker = Record<string, TrackedRelease>;

export type Notify = (
  title: string,
  options: NotificationOptions & { data?: { url: string } },
) => void;

export const notifySettingStore = createStorageStore<boolean>('aotd:notify', false);
export const releaseTrackerStore = createStorageStore<ReleaseTracker>('aotd:release-tracker', {});

export const isNotificationSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

const permissionListeners = new Set<() => void>();
const emitPermissionChange = () => permissionListeners.forEach((listener) => listener());

type PermissionState = NotificationPermission | 'unsupported';

const getPermission = (): PermissionState =>
  isNotificationSupported() ? Notification.permission : 'unsupported';

const subscribePermission = (listener: () => void) => {
  permissionListeners.add(listener);
  let status: PermissionStatus | null = null;
  navigator.permissions
    ?.query?.({ name: 'notifications' as PermissionName })
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
  const pushActive = pushActiveStore.useValue();
  const permission = useSyncExternalStore(subscribePermission, getPermission, () => 'default');
  const enabled = Boolean(enabledSetting) && permission === 'granted';
  return {
    supported: permission !== 'unsupported',
    permission,
    enabled,
    // Push keeps working with every tab closed; otherwise a tab must stay open.
    mode: enabled ? (pushActive ? 'push' : 'tab') : 'off',
  } as const;
}

export async function enableNotifications() {
  if (!isNotificationSupported()) return 'unsupported';
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  notifySettingStore.set(permission === 'granted');
  emitPermissionChange();
  if (permission === 'granted' && isPushSupported()) {
    await subscribeToPush(getNotifyIds());
  }
  return permission;
}

export async function disableNotifications() {
  notifySettingStore.set(false);
  await unsubscribeFromPush();
}

async function showNotification(
  title: string,
  options: NotificationOptions & { data?: { url: string } },
) {
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

// Notifies about tracked episodes of favorites whose airing time has passed. The
// rules (late window, what counts as due) are shared with the push server.
export function checkReleases(now = Date.now(), notify: Notify = showNotification) {
  const tracker = releaseTrackerStore.get() ?? {};
  const notifyIds = new Set(getNotifyIds().map(String));
  const { due, expired } = collectDueReleases(tracker, now, notifyIds);
  if (due.length === 0 && expired.length === 0) return;

  due.forEach(({ id, entry }) => {
    const date = toIsoDateInZone(new Date(entry.airingAt * 1000), getTimeZone());
    notify(entry.title, {
      body: `Episode ${entry.episode} is out now!`,
      icon: entry.image || DEFAULT_ICON,
      badge: DEFAULT_ICON,
      tag: `aotd-${id}-${entry.episode}`,
      data: { url: `/${date}/${id}` },
    });
  });

  const next: ReleaseTracker = { ...tracker };
  [...due.map(({ id }) => id), ...expired].forEach((id) => {
    next[id] = { ...tracker[id], notified: true };
  });
  releaseTrackerStore.set(next);
}

interface QueryClient {
  query: (ids: number[]) => Promise<FavoriteEpisodesResponse>;
}

const defaultClient: QueryClient = {
  query: (ids) =>
    anilistRequest<FavoriteEpisodesResponse>(FAVORITE_EPISODES_QUERY, {
      ids,
      perPage: MEDIA_BATCH_SIZE,
    }),
};

type FavoriteMedia = NonNullable<FavoriteEpisodesResponse['Page']>['media'][number];

// Queries every id, one batch after the other to stay gentle with the AniList rate limit.
async function fetchFavoriteMedia(client: QueryClient, ids: number[]) {
  const media: FavoriteMedia[] = [];
  for (const batch of chunk(ids)) {
    const data = await client.query(batch);
    media.push(...(data?.Page?.media ?? []));
  }
  return media;
}

// Fetches the next episode of every favorite and stores it in the release tracker.
export async function refreshReleaseTracker(
  client: QueryClient = defaultClient,
  now = Date.now(),
  notify: Notify = showNotification,
) {
  const ids = getNotifyIds();
  checkReleases(now, notify);
  if (ids.length === 0) return;

  const mediaList = await fetchFavoriteMedia(client, ids);
  const tracker = mergeNextEpisodes(releaseTrackerStore.get() ?? {}, mediaList, ids, now);
  releaseTrackerStore.set(tracker);
}

// Keeps release notifications running. With Web Push the server does the work and
// this only syncs the favorites; without it, checks run while a tab is open.
export function useReleaseNotifications() {
  const { mode } = useNotificationStatus();
  const favorites = favoritesStore.useValue();

  useEffect(() => {
    if (mode !== 'push') return undefined;
    const timer = setTimeout(() => {
      syncPushFavorites(getNotifyIds()).catch(() => {});
    }, PUSH_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [mode, favorites]);

  useEffect(() => {
    if (mode !== 'tab') return undefined;
    const refresh = () => {
      refreshReleaseTracker().catch(() => {});
    };
    refresh();
    const refreshId = setInterval(refresh, REFRESH_INTERVAL_MS);
    const checkId = setInterval(() => checkReleases(), CHECK_INTERVAL_MS);
    return () => {
      clearInterval(refreshId);
      clearInterval(checkId);
    };
  }, [mode, favorites]);
}
