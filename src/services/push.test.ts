import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushActiveStore, subscribeToPush, urlBase64ToUint8Array } from './push';

afterEach(() => {
  pushActiveStore.reset();
  vi.unstubAllGlobals();
});

describe('push', () => {
  it('decodes base64url VAPID keys', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID_-8'))).toEqual([1, 2, 3, 255, 239]);
  });

  it('falls back when push is not available', async () => {
    await expect(subscribeToPush([1])).resolves.toBe(false);
    expect(pushActiveStore.get()).toBe(false);
  });

  it('registers the subscription and favorites on the push server', async () => {
    const subscription = {
      endpoint: 'https://push.example/1',
      toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'a', auth: 'b' } }),
    };
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(subscription),
      },
    };
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.stubGlobal('Notification', function Notification() {});
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ publicKey: 'AQID' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(subscribeToPush([5, 7])).resolves.toBe(true);

    expect(registration.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/push/subscription');
    expect(JSON.parse(init.body).mediaIds).toEqual([5, 7]);
    expect(pushActiveStore.get()).toBe(true);

    Reflect.deleteProperty(navigator, 'serviceWorker');
  });
});
