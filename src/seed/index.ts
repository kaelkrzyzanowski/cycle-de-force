import { exercisesFromTemplates } from './exercises';
import { nativeTemplates } from './templates';

export { nativeTemplates, TEMPLATE_IDS } from './templates';

/** Incrémenter pour ajouter de nouveaux éléments natifs lors d'une mise à jour. */
export const SEED_VERSION = 1;

export function seedData() {
  const templates = nativeTemplates();
  return { templates, exercises: exercisesFromTemplates(templates) };
}
