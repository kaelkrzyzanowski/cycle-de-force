import { displayKg, displayReps, isRealized } from './load';
import type { Maxes, Rounding, Session, SessionSet } from './types';

export interface Totals {
  tonnage: number;
  reps: number;
  kgPerRep: number;
}

/** Tonnage, reps et kg/rep des séries réalisées (VALIDATED, FAILED, CLUSTER), toutes séries incluses. */
export function setsTotals(sets: readonly SessionSet[], max: Maxes, rounding: Rounding): Totals {
  let tonnage = 0;
  let reps = 0;
  for (const set of sets) {
    if (!isRealized(set.status)) continue;
    const r = displayReps(set);
    reps += r;
    tonnage += r * (displayKg(set, max, rounding) ?? 0);
  }
  tonnage = Math.round(tonnage * 100) / 100;
  return { tonnage, reps, kgPerRep: reps === 0 ? 0 : Math.round((tonnage / reps) * 10) / 10 };
}

export function sessionTotals(session: Session, max: Maxes, rounding: Rounding): Totals {
  return setsTotals(
    session.exercises.flatMap((e) => e.sets),
    max,
    rounding,
  );
}
