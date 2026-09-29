import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import type { Repository } from '../data/repository';
import { effectiveMax, exerciseMaxes } from '../domain/max';
import type { Exercise, Maxes, MaxId, Settings } from '../domain/types';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface AppContextValue {
  repo: Repository;
  settings: Settings;
  /** Catalogue d'exercices, rechargé après chaque écriture. */
  exercises: ReadonlyMap<string, Exercise>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  /** Relit les réglages depuis la base (après une restauration). */
  reloadSettings(): Promise<void>;
  /** Incrémenté à chaque écriture : les écrans rechargent leurs données. */
  dataVersion: number;
  refresh(): void;
  toast(message: string, action?: ToastAction): void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext manquant');
  return ctx;
}

/** Noms des RM : complet (« Squat ») ou abrégé après un % (« S »), et liste des exercices avec RM. */
export function useMaxNames() {
  const { exercises } = useApp();
  const name = (id: MaxId): string => exercises.get(id)?.name ?? id;
  const short = (id: MaxId): string => exercises.get(id)?.short?.trim() || name(id);
  const withMax = [...exercises.values()].filter((e) => e.hasMax);
  return { name, short, withMax };
}

/** RM actuels des exercices, et RM effectifs d'un cycle (ceux du cycle, complétés par ceux des exercices). */
export function useMaxOf() {
  const { exercises } = useApp();
  const fallback = exerciseMaxes(exercises.values());
  return { fallback, maxOf: (cycleMax?: Maxes): Maxes => effectiveMax(cycleMax, fallback) };
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
