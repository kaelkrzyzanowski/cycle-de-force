import { addDays } from './dates';
import { sessionLabel } from './templates';
import type { IsoDate, Session, SessionTemplate } from './types';

/** Heure « HH:MM » valide (00:00 à 23:59). */
export const REMINDER_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Rappels programmés au plus ce nombre de jours à l'avance (recalculés à chaque ouverture de l'app). */
export const REMINDER_HORIZON_DAYS = 30;
/** Plafond de rappels programmés en même temps. */
export const REMINDER_MAX = 60;

export interface SessionReminder {
  sessionId: string;
  /** Instant du rappel (ms depuis 1970, heure locale du téléphone). */
  at: number;
  title: string;
  time: string;
}

/** Instant local « date + heure » en millisecondes. */
export function reminderInstant(date: IsoDate, time: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm).getTime();
}

/**
 * Rappels à programmer : séances à venir dont le modèle a une heure de rappel, pas encore commencées
 * (aucune série réalisée), dans l'horizon donné, triées par heure.
 */
export function plannedReminders(
  sessions: readonly Session[],
  templates: ReadonlyMap<string, SessionTemplate>,
  now: number,
  today: IsoDate,
  horizonDays = REMINDER_HORIZON_DAYS,
  max = REMINDER_MAX,
): SessionReminder[] {
  const last = addDays(today, horizonDays);
  const out: SessionReminder[] = [];
  for (const s of sessions) {
    const template = s.templateId ? templates.get(s.templateId) : undefined;
    const time = template?.reminderTime;
    if (!template || !time || !REMINDER_TIME.test(time)) continue;
    if (s.date < today || s.date > last) continue;
    if (s.exercises.some((e) => e.sets.some((x) => x.status !== 'PLANNED'))) continue;
    const at = reminderInstant(s.date, time);
    if (at <= now) continue;
    out.push({ sessionId: s.id, at, title: sessionLabel(s, template), time });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, max);
}
