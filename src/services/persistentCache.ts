// Small persistent response cache in localStorage. It lets a reload show data
// without waiting for AniList and keeps the last schedule available offline.

const PREFIX = 'aotd:cache:v1:';
const INDEX_KEY = `${PREFIX}index`;
const MAX_ENTRIES = 40;
const MAX_ENTRY_BYTES = 400 * 1024;
// No caller accepts data older than this (the longest offline fallback), so an
// entry past it is dead weight and is removed instead of taking an index slot.
export const MAX_STORED_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Entry<T> {
  savedAt: number;
  data: T;
}

type Index = Record<string, number>;

const readIndex = (): Index => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(INDEX_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Index) : {};
  } catch {
    return {};
  }
};

const writeIndex = (index: Index) => {
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Ignored: the cache is only an optimization.
  }
};

const removeEntry = (key: string, index: Index) => {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Ignored.
  }
  delete index[key];
};

type ReadResult<T> = { status: 'missing' } | { status: 'dead' } | { status: 'ok'; entry: Entry<T> };

const readEntry = <T>(key: string, now: number): ReadResult<T> => {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PREFIX + key);
  } catch {
    return { status: 'missing' };
  }
  if (!raw) return { status: 'missing' };
  try {
    const entry = JSON.parse(raw) as Entry<T>;
    if (!entry || typeof entry.savedAt !== 'number' || now - entry.savedAt > MAX_STORED_AGE_MS) {
      return { status: 'dead' };
    }
    return { status: 'ok', entry };
  } catch {
    return { status: 'dead' };
  }
};

// Returns the cached value and when it was saved, when it is younger than
// maxAgeMs. Entries that are corrupted or older than MAX_STORED_AGE_MS are deleted
// and dropped from the index. Younger entries are kept even when they are too old
// for this caller, since another caller may still use them as an offline fallback.
export function readPersistentEntry<T>(key: string, maxAgeMs: number, now = Date.now()) {
  const result = readEntry<T>(key, now);
  if (result.status === 'dead') {
    const index = readIndex();
    removeEntry(key, index);
    writeIndex(index);
    return undefined;
  }
  if (result.status !== 'ok' || now - result.entry.savedAt > maxAgeMs) return undefined;
  return result.entry;
}

// Returns the cached value when it is younger than maxAgeMs, otherwise undefined.
export function readPersistent<T>(key: string, maxAgeMs: number, now = Date.now()) {
  return readPersistentEntry<T>(key, maxAgeMs, now)?.data;
}

// Same as readPersistent but never writes to storage, so it is safe to call
// while React renders.
export function peekPersistent<T>(key: string, maxAgeMs: number, now = Date.now()) {
  const result = readEntry<T>(key, now);
  if (result.status !== 'ok' || now - result.entry.savedAt > maxAgeMs) return undefined;
  return result.entry.data;
}

// Stores a value, evicting the oldest entries when the cache is full or the
// browser storage quota is reached.
export function writePersistent<T>(key: string, data: T, now = Date.now()) {
  let serialized: string;
  try {
    serialized = JSON.stringify({ savedAt: now, data } satisfies Entry<T>);
  } catch {
    return;
  }
  if (serialized.length > MAX_ENTRY_BYTES) return;

  const index = readIndex();
  // Drop dead entries first, so they never push out data that is still useful.
  Object.entries(index).forEach(([name, savedAt]) => {
    if (typeof savedAt !== 'number' || now - savedAt > MAX_STORED_AGE_MS) removeEntry(name, index);
  });
  index[key] = now;
  const ordered = Object.entries(index).sort((a, b) => a[1] - b[1]);
  while (ordered.length > MAX_ENTRIES) {
    const [oldest] = ordered.shift() as [string, number];
    removeEntry(oldest, index);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      window.localStorage.setItem(PREFIX + key, serialized);
      writeIndex(index);
      return;
    } catch {
      // Quota reached: drop the oldest entry and try again.
      const victim = Object.entries(index)
        .filter(([name]) => name !== key)
        .sort((a, b) => a[1] - b[1])[0];
      if (!victim) return;
      removeEntry(victim[0], index);
    }
  }
}

export function clearPersistentCache() {
  const index = readIndex();
  Object.keys(index).forEach((key) => removeEntry(key, index));
  try {
    window.localStorage.removeItem(INDEX_KEY);
  } catch {
    // Ignored.
  }
}
