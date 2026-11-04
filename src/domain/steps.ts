import { addDays } from './dates';
import type { DailySteps, IsoDate } from './types';

/** Longueur moyenne d'un pas (m), pour estimer la distance marchée. */
export const STRIDE_M = 0.75;

export const stepsToKm = (steps: number): number => Math.round((steps * STRIDE_M) / 10) / 100;

/**
 * Fusionne les comptes du podomètre avec ceux déjà enregistrés : pour chaque jour, le plus grand l'emporte
 * (le compteur du téléphone repart de zéro après une réinstallation, l'historique restauré est alors plus complet).
 * Ne renvoie que les jours à écrire.
 */
export function mergeSteps(stored: readonly DailySteps[], counted: Readonly<Record<IsoDate, number>>): DailySteps[] {
  const known = new Map(stored.map((d) => [d.date, d.steps]));
  return Object.entries(counted)
    .filter(([date, steps]) => Number.isInteger(steps) && steps > (known.get(date) ?? 0))
    .map(([date, steps]) => ({ date, steps }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Les `days` derniers jours jusqu'à `today` compris, jours sans pas à 0. */
export function lastDays(list: readonly DailySteps[], today: IsoDate, days: number): DailySteps[] {
  const byDate = new Map(list.map((d) => [d.date, d.steps]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    return { date, steps: byDate.get(date) ?? 0 };
  });
}

/** Avancement vers l'objectif, entre 0 et 1. */
export const goalProgress = (steps: number, goal: number): number => (goal > 0 ? Math.min(1, steps / goal) : 0);
