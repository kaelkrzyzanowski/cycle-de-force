import { exercisesFromTemplates } from './exercises';
import { nativeTemplates } from './templates';

export { nativeTemplates, TEMPLATE_IDS } from './templates';
export { DEFAULT_MAX, DEFAULT_WEEKLY_PLAN, exampleCycle } from './exampleCycle';

/** Incrémenter pour ajouter de nouveaux éléments natifs lors d'une mise à jour. */
export const SEED_VERSION = 2; // 2 : semaine de deload (S0) des modèles natifs

export function seedData() {
  const templates = nativeTemplates();
  return { templates, exercises: exercisesFromTemplates(templates) };
}
