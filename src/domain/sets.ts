import { plannedKg } from './load';
import type { Maxes, Rounding, SessionSet } from './types';

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
