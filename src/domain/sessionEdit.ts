import type { LoadRule, Session, SessionExercise, SetPrescription } from './types';

/**
 * Modification de séance exprimée comme une opération, pour pouvoir la rejouer
 * sur les séances suivantes du même modèle. Les exercices sont désignés par exerciseId.
 */
export type SessionEdit =
  | { kind: 'renameSession'; name: string }
  | { kind: 'addExercise'; exerciseId: string; name: string; sets: SetPrescription[] }
  | { kind: 'removeExercise'; exerciseId: string }
  | { kind: 'moveExercise'; exerciseId: string; delta: -1 | 1 }
  | { kind: 'renameExercise'; exerciseId: string; newExerciseId: string; name: string }
  | { kind: 'addSet'; exerciseId: string; set: SetPrescription }
  | { kind: 'removeSet'; exerciseId: string; index: number }
  | { kind: 'updateSet'; exerciseId: string; index: number; reps: number; load: LoadRule };

const untouched = (e: SessionExercise): boolean => e.sets.every((s) => s.status === 'PLANNED');

function withExercises(session: Session, exercises: SessionExercise[]): Session {
  return { ...session, exercises: exercises.map((e, position) => ({ ...e, position })) };
}

function reindex(e: SessionExercise): SessionExercise {
  return { ...e, sets: e.sets.map((s, index) => ({ ...s, index })) };
}

/**
 * Applique une opération. Renvoie null si elle ne s'applique pas : exercice absent,
 * ou série déjà réalisée (seules les séries PLANNED sont modifiables).
 * En propagation, un exercice déjà présent n'est pas ajouté une seconde fois.
 */
export function applyEdit(session: Session, edit: SessionEdit, newId: () => string, propagate = false): Session | null {
  if (edit.kind === 'renameSession') return session.name === edit.name ? null : { ...session, name: edit.name };

  const i = session.exercises.findIndex((e) => e.exerciseId === edit.exerciseId);
  const ex = session.exercises[i];

  if (edit.kind === 'addExercise') {
    if (propagate && ex) return null;
    const added: SessionExercise = {
      id: newId(),
      exerciseId: edit.exerciseId,
      name: edit.name,
      position: session.exercises.length,
      sets: edit.sets.map((s, index) => ({ index, plannedReps: s.reps, load: structuredClone(s.load), status: 'PLANNED' })),
    };
    return withExercises(session, [...session.exercises, added]);
  }

  if (!ex) return null;
  const replace = (next: SessionExercise): Session =>
    withExercises(
      session,
      session.exercises.map((e, j) => (j === i ? next : e)),
    );

  switch (edit.kind) {
    case 'removeExercise':
      return untouched(ex) ? withExercises(session, session.exercises.filter((_, j) => j !== i)) : null;

    case 'moveExercise': {
      const j = i + edit.delta;
      const other = session.exercises[j];
      if (!other) return null;
      const list = [...session.exercises];
      list[i] = other;
      list[j] = ex;
      return withExercises(session, list);
    }

    case 'renameExercise':
      if (!untouched(ex) || (ex.exerciseId === edit.newExerciseId && ex.name === edit.name)) return null;
      return replace({ ...ex, exerciseId: edit.newExerciseId, name: edit.name });

    case 'addSet':
      return replace({
        ...ex,
        sets: [...ex.sets, { index: ex.sets.length, plannedReps: edit.set.reps, load: structuredClone(edit.set.load), status: 'PLANNED' }],
      });

    case 'removeSet': {
      const set = ex.sets.find((s) => s.index === edit.index);
      if (!set || set.status !== 'PLANNED') return null;
      return replace(reindex({ ...ex, sets: ex.sets.filter((s) => s !== set) }));
    }

    case 'updateSet': {
      const set = ex.sets.find((s) => s.index === edit.index);
      if (!set || set.status !== 'PLANNED') return null;
      return replace({
        ...ex,
        sets: ex.sets.map((s) => (s === set ? { ...s, plannedReps: edit.reps, load: structuredClone(edit.load) } : s)),
      });
    }
  }
}

/** Ajoute une opération à une liste en fusionnant les modifications successives d'une même série. */
export function pushEdit(edits: readonly SessionEdit[], edit: SessionEdit): SessionEdit[] {
  const last = edits.at(-1);
  const sameTarget =
    last &&
    ((last.kind === 'updateSet' && edit.kind === 'updateSet' && last.exerciseId === edit.exerciseId && last.index === edit.index) ||
      (last.kind === 'renameSession' && edit.kind === 'renameSession'));
  return sameTarget ? [...edits.slice(0, -1), edit] : [...edits, edit];
}

/** Séances suivantes du même modèle dans le même cycle. */
export function followingSessions(source: Session, sessions: readonly Session[]): Session[] {
  if (!source.cycleId || !source.templateId) return [];
  return sessions.filter(
    (s) => s.id !== source.id && s.cycleId === source.cycleId && s.templateId === source.templateId && s.date > source.date,
  );
}

/** Rejoue les opérations sur les séances suivantes ; ne renvoie que celles réellement modifiées. */
export function propagateEdits(
  source: Session,
  sessions: readonly Session[],
  edits: readonly SessionEdit[],
  newId: () => string,
): Session[] {
  return followingSessions(source, sessions).flatMap((target) => {
    let current = target;
    let changed = false;
    for (const edit of edits) {
      const next = applyEdit(current, edit, newId, true);
      if (next) {
        current = next;
        changed = true;
      }
    }
    return changed ? [current] : [];
  });
}
