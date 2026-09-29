import { exercisesFromTemplates } from './exercises';
import { nativeTemplates } from './templates';

/**
 * Programme d'exemple (le cahier d'origine : 5 modèles et le cycle « Bloc 0 »), utilisé uniquement
 * comme jeu de données par les tests unitaires et e2e. L'app, elle, démarre vierge.
 */
export { nativeTemplates, TEMPLATE_IDS } from './templates';
export { DEFAULT_MAX, DEFAULT_WEEKLY_PLAN, exampleCycle } from './exampleCycle';

export function exampleProgram() {
  const templates = nativeTemplates();
  return { templates, exercises: exercisesFromTemplates(templates) };
}
