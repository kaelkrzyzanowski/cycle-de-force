import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Repository } from '../data/repository';
import type { Settings } from '../domain/types';

export interface AppContextValue {
  repo: Repository;
  settings: Settings;
  updateSettings(patch: Partial<Settings>): Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext manquant');
  return ctx;
}
