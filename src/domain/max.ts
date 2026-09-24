import { plannedKg } from './load';
import { LIFTS } from './types';
import type { Cycle, Lift, MaxChange, Maxes, Rounding, Session } from './types';

export interface PlannedLoadChange {
  sessionId: string;
  date: string;
  exerciseName: string;
  setIndex: number;
  lift: Lift;
  fromKg: number;
  toKg: number;
}

/**
 * Séries PLANNED dont la charge affichée changera avec les nouveaux max.
 * Les séries réalisées ont leur charge figée et ne sont jamais touchées.
 */
export function previewMaxChange(
  sessions: readonly Session[],
  oldMax: Maxes,
  newMax: Maxes,
  rounding: Rounding,
): PlannedLoadChange[] {
  const changes: PlannedLoadChange[] = [];
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        if (set.status !== 'PLANNED' || set.load.kind !== 'PERCENT') continue;
        const fromKg = plannedKg(set.load, oldMax, rounding);
        const toKg = plannedKg(set.load, newMax, rounding);
        if (fromKg === null || toKg === null || fromKg === toKg) continue;
        changes.push({
          sessionId: session.id,
          date: session.date,
          exerciseName: exercise.name,
          setIndex: set.index,
          lift: set.load.lift,
          fromKg,
          toKg,
        });
      }
    }
  }
  return changes;
}

/** Nouveau cycle avec les max mis à jour, et les entrées de journal correspondantes. */
export function applyMaxChange(
  cycle: Cycle,
  newMax: Maxes,
  at: string,
  newId: () => string,
): { cycle: Cycle; log: MaxChange[] } {
  const log: MaxChange[] = LIFTS.filter((lift) => cycle.max[lift] !== newMax[lift]).map((lift) => ({
    id: newId(),
    cycleId: cycle.id,
    lift,
    from: cycle.max[lift],
    to: newMax[lift],
    at,
  }));
  return { cycle: { ...cycle, max: { ...newMax } }, log };
}
