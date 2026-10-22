// Keeps an in memory Map from growing for the whole life of the tab: expired
// entries are dropped first, then the oldest ones (Map keeps insertion order).
export function pruneMap<K, V>(
  map: Map<K, V>,
  { maxEntries, isExpired }: { maxEntries: number; isExpired: (value: V) => boolean },
) {
  map.forEach((value, key) => {
    if (isExpired(value)) map.delete(key);
  });
  for (const key of map.keys()) {
    if (map.size <= maxEntries) break;
    map.delete(key);
  }
}
