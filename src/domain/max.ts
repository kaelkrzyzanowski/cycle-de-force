import { plannedKg } from './load';
import type { Cycle, LoadRule, MaxChange, MaxId, Maxes, Rounding, Session, SessionTemplate } from './types';

export interface PlannedLoadChange {
  sessionId: string;
  date: string;
  exerciseName: string;
  setIndex: number;
  maxId: MaxId;
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
          maxId: set.load.of,
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
  const ids = [...new Set([...Object.keys(cycle.max), ...Object.keys(newMax)])];
  const log: MaxChange[] = ids
    .filter((id) => (cycle.max[id] ?? 0) !== (newMax[id] ?? 0))
    .map((id) => ({ id: newId(), cycleId: cycle.id, exerciseId: id, from: cycle.max[id] ?? 0, to: newMax[id] ?? 0, at }));
  return { cycle: { ...cycle, max: { ...newMax } }, log };
}

type WithExercises = { exercises: readonly { sets: readonly { load: LoadRule }[] }[] };

/** RM utilisés par des séries en %, dans l'ordre de première apparition. */
export function maxIdsUsedBy(items: readonly WithExercises[]): MaxId[] {
  const ids = new Set<MaxId>();
  for (const item of items) for (const e of item.exercises) for (const s of e.sets) if (s.load.kind === 'PERCENT') ids.add(s.load.of);
  return [...ids];
}

/** Toutes les semaines des modèles, vues comme des listes d'exercices. */
export function templateWeeks(templates: readonly Pick<SessionTemplate, 'weeks'>[]): WithExercises[] {
  return templates.flatMap((t) => Object.values(t.weeks).map((exercises) => ({ exercises })));
}

/** RM à renseigner pour un cycle : ceux déjà connus, puis ceux utilisés par ses séances. */
export function cycleMaxIds(cycle: Pick<Cycle, 'max'>, sessions: readonly WithExercises[]): MaxId[] {
  return [...new Set([...Object.keys(cycle.max), ...maxIdsUsedBy(sessions)])];
}
