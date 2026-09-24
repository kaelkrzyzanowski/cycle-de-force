import type { IsoDate, Session } from './types';

export type SessionStatus = 'PLANNED' | 'MISSED' | 'IN_PROGRESS' | 'FAILED' | 'INCOMPLETE' | 'VALIDATED';

/** Statut d'une séance dérivé de ses séries (couleur dans le calendrier). */
export function deriveSessionStatus(session: Pick<Session, 'date' | 'exercises'>, today: IsoDate): SessionStatus {
  const sets = session.exercises.flatMap((e) => e.sets);
  const planned = sets.filter((s) => s.status === 'PLANNED').length;
  if (planned === sets.length) return session.date < today ? 'MISSED' : 'PLANNED';
  if (planned > 0) return 'IN_PROGRESS';
  if (sets.some((s) => s.status === 'FAILED')) return 'FAILED';
  if (sets.some((s) => s.status === 'NOT_DONE')) return 'INCOMPLETE';
  return 'VALIDATED';
}
