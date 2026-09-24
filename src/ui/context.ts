import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import type { Repository } from '../data/repository';
import type { Settings } from '../domain/types';

export interface AppContextValue {
  repo: Repository;
  settings: Settings;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  /** Incrémenté à chaque écriture : les écrans rechargent leurs données. */
  dataVersion: number;
  refresh(): void;
  toast(message: string): void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext manquant');
  return ctx;
}

/** Charge des données depuis le repository ; recharge après chaque écriture. */
export function useData<T>(load: (repo: Repository) => Promise<T>, deps: readonly unknown[]): T | undefined {
  const { repo, dataVersion } = useApp();
  const [data, setData] = useState<T | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    load(repo)
      .then((d) => alive && setData(d))
      .catch((err: unknown) => console.error(err));
    return () => {
      alive = false;
    };
  }, [repo, dataVersion, ...deps]);
  return data;
}
