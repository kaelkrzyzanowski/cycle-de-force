import type { Exercise, ExercisePrescription, Lift, SessionTemplate } from '../domain/types';

const ALIASES: Record<string, string[]> = {
  'developpe-couche': ['DC', 'Bench'],
  'souleve-de-terre': ['Deadlift', 'SDT'],
};

function percentLift(ex: ExercisePrescription): Lift | undefined {
  for (const set of ex.sets) if (set.load.kind === 'PERCENT') return set.load.lift;
  return undefined;
}

/** Catalogue d'exercices déduit des modèles ; le mouvement par défaut est celui des % prescrits. */
export function exercisesFromTemplates(templates: readonly SessionTemplate[]): Exercise[] {
  const byId = new Map<string, Exercise>();
  for (const template of templates) {
    for (const week of Object.values(template.weeks)) {
      for (const ex of week) {
        let entry = byId.get(ex.exerciseId);
        if (!entry) {
          entry = { id: ex.exerciseId, name: ex.name, aliases: ALIASES[ex.exerciseId] ?? [] };
          byId.set(ex.exerciseId, entry);
        }
        const lift = percentLift(ex);
        if (entry.defaultLift === undefined && lift) entry.defaultLift = lift;
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
