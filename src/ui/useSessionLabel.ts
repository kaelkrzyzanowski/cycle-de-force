import { sessionLabel } from '../domain/templates';
import type { Session } from '../domain/types';
import { useData } from './context';

/** Nom affiché des séances (« Deadlift 80 % »), d'après le % du mouvement principal ce jour-là. */
export function useSessionLabel(): (session: Pick<Session, 'name' | 'cycleWeek' | 'templateId' | 'exercises'>) => string {
  const templates = useData((repo) => repo.listTemplates(), []) ?? [];
  return (s) => sessionLabel(s, templates.find((t) => t.id === s.templateId));
}
