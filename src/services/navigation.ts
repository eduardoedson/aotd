// Remembers the order of the schedule the visitor came from, so the detail page
// can link to the previous and next anime of that same list.

import { createMemoryStore } from './storage';

export interface ScheduleEntry {
  mediaId: number;
  title: string;
  date: string;
  episode: number;
}

export interface ScheduleContext {
  search: string;
  entries: ScheduleEntry[];
}

const STORAGE_KEY = 'aotd:schedule-context';

const load = (): ScheduleContext | null => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScheduleContext) : null;
  } catch {
    return null;
  }
};

export const scheduleContextStore = createMemoryStore<ScheduleContext | null>(
  typeof window === 'undefined' ? null : load(),
);

export function setScheduleContext(context: ScheduleContext) {
  const current = scheduleContextStore.get();
  if (
    current &&
    current.search === context.search &&
    current.entries.length === context.entries.length &&
    current.entries.every((entry, index) => entry.mediaId === context.entries[index].mediaId)
  ) {
    return;
  }
  scheduleContextStore.set(context);
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Ignored: navigation still works inside the tab.
  }
}

// Removes the parameters that only make sense on the detail page.
export const scheduleSearch = (search: string) => {
  const params = new URLSearchParams(search);
  params.delete('ep');
  const value = params.toString();
  return value ? `?${value}` : '';
};

export function findNeighbours(context: ScheduleContext | null, mediaId: number) {
  if (!context) return { previous: null, next: null };
  // The same anime can appear twice in a week; use its first occurrence.
  const unique = context.entries.filter(
    (entry, index, list) => list.findIndex((other) => other.mediaId === entry.mediaId) === index,
  );
  const position = unique.findIndex((entry) => entry.mediaId === mediaId);
  if (position === -1) return { previous: null, next: null };
  return {
    previous: position > 0 ? unique[position - 1] : null,
    next: position < unique.length - 1 ? unique[position + 1] : null,
  };
}

export function useNeighbours(mediaId: number) {
  const context = scheduleContextStore.useValue();
  return { ...findNeighbours(context, mediaId), search: context?.search ?? '' };
}
