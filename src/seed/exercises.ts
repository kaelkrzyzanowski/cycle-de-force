import { LEGACY_LIFTS } from '../domain/legacyLifts';
import type { Exercise, ExercisePrescription, MaxId, SessionTemplate } from '../domain/types';

function percentOf(ex: ExercisePrescription): MaxId | undefined {
  for (const set of ex.sets) if (set.load.kind === 'PERCENT') return set.load.of;
  return undefined;
}

/**
 * Catalogue d'exercices : les trois mouvements avec RM (Squat, Développé couché, Soulevé de terre),
 * puis ceux des modèles ; le RM par défaut d'un exercice est celui de ses % prescrits.
 */
export function exercisesFromTemplates(templates: readonly SessionTemplate[]): Exercise[] {
  const byId = new Map<string, Exercise>(Object.values(LEGACY_LIFTS).map((e) => [e.id, { ...e, aliases: [...e.aliases] }]));
  for (const template of templates) {
    for (const week of Object.values(template.weeks)) {
      for (const ex of week) {
        let entry = byId.get(ex.exerciseId);
        if (!entry) {
          entry = { id: ex.exerciseId, name: ex.name, aliases: [] };
          byId.set(ex.exerciseId, entry);
        }
        const of = percentOf(ex);
        if (entry.defaultMax === undefined && of && of !== entry.id) entry.defaultMax = of;
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
