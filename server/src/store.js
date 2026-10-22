import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const EMPTY = { subscriptions: {}, tracker: {} };
const RENAME_RETRY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
const RENAME_ATTEMPTS = 5;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// On Windows an antivirus or indexer can briefly lock the target file, which
// makes rename fail with EPERM. Retrying after a short pause is enough.
async function renameWithRetry(rename, from, to) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      if (!RENAME_RETRY_CODES.has(error?.code) || attempt >= RENAME_ATTEMPTS) throw error;
      await wait(25 * attempt);
    }
  }
}

// JSON file storage. Writes go to a uniquely named temporary file first and are
// then renamed, so a crash never leaves a half written file behind. Writes run
// one at a time, and a failed write never blocks the ones queued after it.
export async function createStore(dataDir, fileSystem = fs) {
  const { mkdir, readFile, rename, unlink, writeFile } = fileSystem;
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

  const writeSnapshot = async () => {
    const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    try {
      // The snapshot is taken when the write actually runs, so it always holds
      // the latest data, including changes made while earlier writes were queued.
      await writeFile(temp, JSON.stringify(data));
      await renameWithRetry(rename, temp, file);
    } catch (error) {
      if (unlink) await unlink(temp).catch(() => {});
      throw error;
    }
  };

  let writing = Promise.resolve();
  const persist = () => {
    const operation = writing.catch(() => {}).then(writeSnapshot);
    writing = operation;
    return operation;
  };

  return {
    get data() {
      return data;
    },
    upsertSubscription(subscription, mediaIds, now = Date.now()) {
      const previous = data.subscriptions[subscription.endpoint];
      data.subscriptions[subscription.endpoint] = {
        subscription,
        mediaIds,
        updatedAt: now,
        // Keep the delivery log, so a re-subscribe never repeats a notification.
        sent: previous?.sent ?? {},
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
    // Applies several changes synchronously and saves them with a single write.
    update(mutate) {
      mutate(data);
      return persist();
    },
    persist,
  };
}
