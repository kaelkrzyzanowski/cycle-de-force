import { exercisesFromTemplates } from './exercises';
import { nativeTemplates } from './templates';

export { nativeTemplates, TEMPLATE_IDS } from './templates';
export { DEFAULT_MAX, DEFAULT_WEEKLY_PLAN, exampleCycle } from './exampleCycle';

export { NATIVE_EXERCISE_CATEGORIES, OFFICIAL_EXERCISES } from './officialExercises';

/**
 * Incrémenter pour ajouter des exercices au catalogue lors d'une mise à jour.
 * 3 : nouvelle installation sans modèle ; catalogue d'exercices classé.
 */
export const SEED_VERSION = 3;

/** Programme d'origine (modèles « natifs » et leurs exercices) : plus installé d'office, sert à la réinitialisation et aux tests. */
export function seedData() {
  const templates = nativeTemplates();
  return { templates, exercises: exercisesFromTemplates(templates) };
}
