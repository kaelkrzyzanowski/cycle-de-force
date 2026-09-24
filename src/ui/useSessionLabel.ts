import { sessionLabel } from '../domain/templates';
import type { Session } from '../domain/types';
import { useData } from './context';

/** Nom affiché des séances (« Deadlift S3 »), d'après la semaine de deload de leur modèle. */
export function useSessionLabel(): (session: Pick<Session, 'name' | 'cycleWeek' | 'templateId'>) => string {
  const templates = useData((repo) => repo.listTemplates(), []) ?? [];
  return (s) => sessionLabel(s, templates.find((t) => t.id === s.templateId));
}
