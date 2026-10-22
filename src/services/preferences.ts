import { useEffect } from 'react';
import { createStorageStore } from './storage';

export type Theme = 'dark' | 'light';
export type Density = 'comfortable' | 'compact';
export interface Preferences {
  theme: Theme;
  density: Density;
}

const defaults: Preferences = { theme: 'dark', density: 'comfortable' };
const preferencesStore = createStorageStore<Preferences>('aotd:preferences', defaults);

export function usePreferences() {
  const value = preferencesStore.useValue();
  const update = (patch: Partial<Preferences>) =>
    preferencesStore.set((current) => ({ ...defaults, ...current, ...patch }));
  useEffect(() => {
    document.documentElement.dataset.theme = value.theme;
    document.documentElement.dataset.density = value.density;
  }, [value.theme, value.density]);
  return { ...value, update };
}

// Current theme without the side effects of usePreferences (used by accent colors).
export const useTheme = (): Theme => preferencesStore.useValue()?.theme ?? 'dark';
