import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EMPTY = { subscriptions: {}, tracker: {} };

// JSON file storage. Writes go to a temporary file first and are then renamed,
// so a crash never leaves a half written file behind.
export async function createStore(dataDir) {
  const file = path.join(dataDir, 'push-data.json');
  await mkdir(dataDir, { recursive: true });

  let data = structuredClone(EMPTY);
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    data = {
      subscriptions: parsed.subscriptions ?? {},
      tracker: parsed.tracker ?? {},
    };
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not read push data, starting empty', error);
  }

  let writing = Promise.resolve();
  const persist = () => {
    writing = writing.then(async () => {
      const temp = `${file}.tmp`;
      await writeFile(temp, JSON.stringify(data));
      await rename(temp, file);
    });
    return writing;
  };

  return {
    get data() {
      return data;
    },
    upsertSubscription(subscription, mediaIds, now = Date.now()) {
      data.subscriptions[subscription.endpoint] = {
        subscription,
        mediaIds,
        updatedAt: now,
      };
      return persist();
    },
    removeSubscription(endpoint) {
      if (!data.subscriptions[endpoint]) return Promise.resolve();
      delete data.subscriptions[endpoint];
      return persist();
    },
    setTracker(tracker) {
      data.tracker = tracker;
      return persist();
    },
    persist,
  };
}
