import type { Repository } from '../data/repository';
import { addDays, todayIso } from '../domain/dates';
import { plannedReminders, REMINDER_HORIZON_DAYS } from '../domain/reminders';
import { isNative, loadNative } from '../platform';
import { templatesById } from './actions';
import { href, navigate } from './router';
import { S } from './strings';

/**
 * Reprogramme les rappels de séance (app Android) d'après les séances à venir et l'heure de rappel de leur modèle :
 * tous les anciens rappels sont annulés puis recréés, ce qui suit les déplacements, suppressions et séances commencées.
 */
export async function syncReminders(repo: Repository): Promise<void> {
  if (!isNative) return;
  const today = todayIso();
  const [sessions, templates] = await Promise.all([repo.listSessionsBetween(today, addDays(today, REMINDER_HORIZON_DAYS)), repo.listTemplates()]);
  const list = plannedReminders(sessions, templatesById(templates), Date.now(), today);
  const native = await loadNative();
  await native.syncSessionReminders(
    list.map((r) => ({ sessionId: r.sessionId, at: r.at, title: S.reminders.title(r.title), body: S.reminders.body(r.time) })),
    S.reminders.channel,
  );
}

let timer: number | undefined;

/** Recalcul groupé (plusieurs modifications rapprochées = une seule reprogrammation). */
export function scheduleReminderSync(repo: Repository): void {
  if (!isNative) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncReminders(repo).catch((err: unknown) => console.error(err)), 1500);
}

/** Toucher un rappel ouvre la séance concernée. */
export function installReminderTap(): void {
  if (!isNative) return;
  void loadNative().then((native) => native.onReminderTap((sessionId) => navigate(href.session(sessionId))));
}
