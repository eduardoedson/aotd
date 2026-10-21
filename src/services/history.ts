import { createStorageStore } from './storage';

export interface HistoryItem {
  id: number;
  title: string;
  image?: string | null;
  date: string;
  viewedAt: number;
}
export const historyStore = createStorageStore<HistoryItem[]>('aotd:history', []);

export function addHistory(item: Omit<HistoryItem, 'viewedAt'>) {
  historyStore.set((current) =>
    [{ ...item, viewedAt: Date.now() }, ...current.filter((entry) => entry.id !== item.id)].slice(
      0,
      30,
    ),
  );
}

export const useHistory = () => historyStore.useValue();

export const clearHistory = () => historyStore.set([]);
