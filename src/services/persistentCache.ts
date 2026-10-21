// Small persistent response cache in localStorage. It lets a reload show data
// without waiting for AniList and keeps the last schedule available offline.

const PREFIX = 'aotd:cache:v1:';
const INDEX_KEY = `${PREFIX}index`;
const MAX_ENTRIES = 40;
const MAX_ENTRY_BYTES = 400 * 1024;

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

// Returns the cached value when it is younger than maxAgeMs, otherwise undefined.
export function readPersistent<T>(key: string, maxAgeMs: number, now = Date.now()) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Entry<T>;
    if (!entry || typeof entry.savedAt !== 'number' || now - entry.savedAt > maxAgeMs) {
      return undefined;
    }
    return entry.data;
  } catch {
    return undefined;
  }
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
