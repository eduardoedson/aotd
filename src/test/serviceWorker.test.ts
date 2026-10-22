import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// Runs public/sw.js against small fakes of the service worker globals.

const ORIGIN = 'https://aotd.test';
const source = readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');

type Listener = (event: Record<string, unknown>) => void;

class FakeCache {
  entries = new Map<string, Response>();

  private key(request: string | Request) {
    return new URL(typeof request === 'string' ? request : request.url, ORIGIN).href;
  }

  async put(request: string | Request, response: Response) {
    this.entries.set(this.key(request), response);
  }

  async match(request: string | Request) {
    return this.entries.get(this.key(request))?.clone();
  }

  async delete(request: string | Request) {
    return this.entries.delete(this.key(request));
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  async addAll() {}
}

function loadWorker({ fetchImpl = vi.fn(), windows = [] as unknown[] } = {}) {
  const stores = new Map<string, FakeCache>();
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new FakeCache());
      return stores.get(name) as FakeCache;
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: string | Request) => {
      for (const cache of stores.values()) {
        const found = await cache.match(request);
        if (found) return found;
      }
      return undefined;
    },
  };
  const listeners = new Map<string, Listener>();
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(),
    registration: {
      showNotification: vi.fn(),
      pushManager: { subscribe: vi.fn() },
    },
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn().mockResolvedValue(windows),
      openWindow: vi.fn().mockResolvedValue({}),
    },
  };
  new Function('self', 'caches', 'fetch', source)(self, caches, fetchImpl);

  const dispatch = async (type: string, extra: Record<string, unknown> = {}) => {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)?.({
      ...extra,
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    await Promise.all(pending);
  };

  return { self, caches, stores, dispatch };
}

describe('service worker', () => {
  it('renews a replaced push subscription with the stored endpoint', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ publicKey: 'AQID' })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const worker = loadWorker({ fetchImpl });
    const meta = await worker.caches.open('aotd-meta');
    await meta.put('/__aotd/push-endpoint', new Response('https://fcm.googleapis.com/old'));
    const fresh = {
      endpoint: 'https://fcm.googleapis.com/new',
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/new',
        keys: { p256dh: 'a', auth: 'b' },
      }),
    };
    worker.self.registration.pushManager.subscribe.mockResolvedValue(fresh);

    await worker.dispatch('pushsubscriptionchange', {
      oldSubscription: null,
      newSubscription: null,
    });

    const [url, init] = fetchImpl.mock.calls[1];
    expect(url).toBe('/api/push/subscription');
    expect(JSON.parse(init.body)).toEqual({
      subscription: fresh.toJSON(),
      oldEndpoint: 'https://fcm.googleapis.com/old',
    });
    expect(await (await meta.match('/__aotd/push-endpoint'))?.text()).toBe(fresh.endpoint);
  });

  it('does nothing when the old endpoint is unknown', async () => {
    const fetchImpl = vi.fn();
    const worker = loadWorker({ fetchImpl });
    await worker.dispatch('pushsubscriptionchange', {
      oldSubscription: null,
      newSubscription: null,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('opens a new window when the existing tab cannot navigate', async () => {
    const tab = {
      url: `${ORIGIN}/2026-10-21`,
      focus: vi.fn().mockImplementation(async () => tab),
      navigate: vi.fn().mockRejectedValue(new TypeError('not controlled')),
    };
    const worker = loadWorker({ windows: [tab] });

    await worker.dispatch('notificationclick', {
      notification: { close: vi.fn(), data: { url: '/2026-10-22/5' } },
    });

    expect(tab.navigate).toHaveBeenCalledWith(`${ORIGIN}/2026-10-22/5`);
    expect(worker.self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/2026-10-22/5`);
  });

  it('navigates the existing tab when it can', async () => {
    const tab = {
      url: `${ORIGIN}/`,
      focus: vi.fn().mockImplementation(async () => tab),
      navigate: vi.fn().mockImplementation(async () => tab),
    };
    const worker = loadWorker({ windows: [tab] });

    await worker.dispatch('notificationclick', {
      notification: { close: vi.fn(), data: { url: '/x' } },
    });

    expect(worker.self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('drops old caches and old build assets on activate, keeping the push endpoint', async () => {
    const worker = loadWorker();
    const current = await worker.caches.open('aotd-v3');
    const old = new Date(Date.now() - 40 * 86400000).toUTCString();
    const recent = new Date().toUTCString();
    await current.put('/assets/old.js', new Response('a', { headers: { date: old } }));
    await current.put('/assets/new.js', new Response('b', { headers: { date: recent } }));
    await current.put('/index.html', new Response('c', { headers: { date: old } }));
    await worker.caches.open('aotd-v2');
    await (await worker.caches.open('aotd-meta')).put('/__aotd/push-endpoint', new Response('x'));

    await worker.dispatch('activate');

    expect([...worker.stores.keys()].sort()).toEqual(['aotd-meta', 'aotd-v3']);
    const kept = [...current.entries.keys()].map((url) => new URL(url).pathname).sort();
    expect(kept).toEqual(['/assets/new.js', '/index.html']);
  });
});
