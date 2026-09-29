import type { Session, SessionTemplate } from './types';

/**
 * Nouveau nom d'un exercice, reporté dans les modèles et les séances qui le portent (le nom y est
 * recopié pour l'affichage). Ne renvoie que ce qui change.
 */
export function renameExercise(
  exerciseId: string,
  name: string,
  templates: readonly SessionTemplate[],
  sessions: readonly Session[],
): { templates: SessionTemplate[]; sessions: Session[] } {
  const rename = <T extends { exerciseId: string; name: string }>(list: readonly T[]): T[] | null =>
    list.some((e) => e.exerciseId === exerciseId && e.name !== name)
      ? list.map((e) => (e.exerciseId === exerciseId ? { ...e, name } : e))
      : null;

  const changedTemplates = templates.flatMap((t) => {
    let touched = false;
    const weeks = Object.fromEntries(
      Object.entries(t.weeks).map(([w, list]) => {
        const next = rename(list);
        if (next) touched = true;
        return [w, next ?? list];
      }),
    );
    return touched ? [{ ...t, weeks }] : [];
  });
  const changedSessions = sessions.flatMap((s) => {
    const exercises = rename(s.exercises);
    return exercises ? [{ ...s, exercises }] : [];
  });
  return { templates: changedTemplates, sessions: changedSessions };
}
