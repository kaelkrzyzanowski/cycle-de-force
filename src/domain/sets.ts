import { plannedKg } from './load';
import type { Maxes, Rounding, Session, SessionExercise, SessionSet } from './types';

/** Validable d'un tap : charge et reps connues à l'avance. */
export function canQuickValidate(set: SessionSet): boolean {
  return set.load.kind !== 'NONE' && set.plannedReps > 0;
}

/** Remplace une série d'un exercice (identifié par SessionExercise.id). */
export function mapSet(
  session: Session,
  exerciseRowId: string,
  index: number,
  fn: (set: SessionSet) => SessionSet,
): Session {
  return {
    ...session,
    exercises: session.exercises.map((e) =>
      e.id !== exerciseRowId ? e : { ...e, sets: e.sets.map((s) => (s.index === index ? fn(s) : s)) },
    ),
  };
}

export function mapExercise(session: Session, exerciseRowId: string, fn: (e: SessionExercise) => SessionExercise): Session {
  return { ...session, exercises: session.exercises.map((e) => (e.id === exerciseRowId ? fn(e) : e)) };
}

/** « Tout valider » : valide les séries encore prévues dont la charge est connue. */
export function validateExercise(exercise: SessionExercise, max: Maxes, rounding: Rounding): SessionExercise {
  return {
    ...exercise,
    sets: exercise.sets.map((s) => (s.status === 'PLANNED' && canQuickValidate(s) ? validateSet(s, max, rounding) : s)),
  };
}

function withoutActuals(set: SessionSet): SessionSet {
  const copy = { ...set };
  delete copy.actualReps;
  delete copy.actualKg;
  return copy;
}

/** Tap sur une pastille : réalisé = prévu, charge figée. */
export function validateSet(set: SessionSet, max: Maxes, rounding: Rounding): SessionSet {
  const kg = plannedKg(set.load, max, rounding);
  const next: SessionSet = { ...withoutActuals(set), status: 'VALIDATED', actualReps: set.plannedReps };
  if (kg !== null) next.actualKg = kg;
  return next;
}

/** Retour à PLANNED : les valeurs réalisées sont effacées. */
export function resetSet(set: SessionSet): SessionSet {
  return { ...withoutActuals(set), status: 'PLANNED' };
}

/** Panneau bas : Échec, Cluster, Non réalisé (ou Validé avec valeurs ajustées). */
export function recordSet(
  set: SessionSet,
  status: 'VALIDATED' | 'FAILED' | 'CLUSTER' | 'NOT_DONE',
  actual: { reps?: number; kg?: number },
  max: Maxes,
  rounding: Rounding,
): SessionSet {
  if (status === 'NOT_DONE') return { ...withoutActuals(set), status };
  const kg = actual.kg ?? plannedKg(set.load, max, rounding);
  const next: SessionSet = { ...withoutActuals(set), status, actualReps: actual.reps ?? set.plannedReps };
  if (kg !== null) next.actualKg = kg;
  return next;
}
