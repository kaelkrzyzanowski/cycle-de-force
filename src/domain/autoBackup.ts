import type { IsoDate } from './types';

/** Dossier de la sauvegarde automatique (dans « Documents » sur Android). */
export const AUTO_BACKUP_DIR = 'CycleDeForce';
/** Nombre de jours de sauvegarde automatique conservés. */
export const AUTO_BACKUP_KEEP = 14;
/** Intervalle minimal entre deux sauvegardes automatiques. */
export const AUTO_BACKUP_MIN_INTERVAL_MS = 2 * 60_000;

const NAME = /^cycle-de-force-(\d{4}-\d{2}-\d{2})(?:-(\d{4}))?\.json$/;

/** Nom de secours quand le fichier du jour existe mais n'appartient plus à l'app (après réinstallation). */
export function fallbackBackupName(date: IsoDate, now: Date): string {
  const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `cycle-de-force-${date}-${hhmm}.json`;
}

/**
 * Fichiers à supprimer pour ne garder que les `keep` jours les plus récents
 * (toutes les copies d'un même jour comptent pour un seul jour). Les autres fichiers sont ignorés.
 */
export function backupsToPrune(names: readonly string[], keep: number = AUTO_BACKUP_KEEP): string[] {
  const byDay = new Map<string, string[]>();
  for (const name of names) {
    const day = NAME.exec(name)?.[1];
    if (day) byDay.set(day, [...(byDay.get(day) ?? []), name]);
  }
  const days = [...byDay.keys()].sort().reverse();
  return days.slice(keep).flatMap((d) => byDay.get(d) ?? []);
}

export function isAutoBackupDue(lastAt: string | undefined, now: number, minIntervalMs = AUTO_BACKUP_MIN_INTERVAL_MS): boolean {
  if (!lastAt) return true;
  const last = Date.parse(lastAt);
  return !Number.isFinite(last) || now - last >= minIntervalMs;
}
