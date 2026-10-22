// Web Push client. Talks to the small AOTD push server (see server/), which sends
// release notifications even when every AOTD tab is closed.

import { createStorageStore } from './storage';

const PUSH_API = '/api/push';
// Shared with public/sw.js: the service worker reads the current endpoint here
// when the browser replaces the subscription without telling it the old one.
const META_CACHE = 'aotd-meta';
const PUSH_ENDPOINT_KEY = '/__aotd/push-endpoint';

async function rememberEndpoint(endpoint: string | null) {
  try {
    if (typeof caches === 'undefined') return;
    const cache = await caches.open(META_CACHE);
    if (endpoint) {
      await cache.put(PUSH_ENDPOINT_KEY, new Response(endpoint));
    } else {
      await cache.delete(PUSH_ENDPOINT_KEY);
    }
  } catch {
    // Only an aid for the service worker; push still works without it.
  }
}

// True while this browser has an active push subscription registered on the server.
export const pushActiveStore = createStorageStore<boolean>('aotd:push', false);

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

// Converts the VAPID public key (base64url) to the format PushManager expects.
export function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

async function getRegistration() {
  if (!isPushSupported()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

async function getPublicKey() {
  try {
    const response = await fetch(`${PUSH_API}/public-key`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { publicKey?: string };
    return body.publicKey ?? null;
  } catch {
    return null;
  }
}

async function sendSubscription(subscription: PushSubscription, mediaIds: number[]) {
  const response = await fetch(`${PUSH_API}/subscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON(), mediaIds }),
  });
  if (!response.ok) throw new Error(`Push server answered ${response.status}`);
  await rememberEndpoint(subscription.endpoint);
}

// Subscribes this browser and registers its favorites. Returns false when push is
// not available (no service worker, no push server), so the caller can fall back.
export async function subscribeToPush(mediaIds: number[]) {
  const registration = await getRegistration();
  if (!registration) return false;
  const publicKey = await getPublicKey();
  if (!publicKey) return false;

  try {
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
    await sendSubscription(subscription, mediaIds);
    pushActiveStore.set(true);
    return true;
  } catch {
    pushActiveStore.set(false);
    return false;
  }
}

// Sends the current favorites to the push server.
export async function syncPushFavorites(mediaIds: number[]) {
  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    pushActiveStore.set(false);
    return false;
  }
  await sendSubscription(subscription, mediaIds);
  return true;
}

export async function unsubscribeFromPush() {
  pushActiveStore.set(false);
  await rememberEndpoint(null);
  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await fetch(`${PUSH_API}/subscription`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch {
    // The server drops dead subscriptions on its own when sending fails.
  }
  await subscription.unsubscribe().catch(() => false);
}
