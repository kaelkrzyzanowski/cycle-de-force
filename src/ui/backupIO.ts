import type { Repository } from '../data/repository';
import { AUTO_BACKUP_MIN_INTERVAL_MS, isAutoBackupDue } from '../domain/autoBackup';
import { backupFileName, buildBackup } from '../domain/backup';
import { todayIso } from '../domain/dates';
import { isNative, loadNative } from '../platform';
import { S } from './strings';

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Enregistre un fichier JSON : feuille de partage dans l'app Android, téléchargement dans le navigateur. */
export async function saveJsonFile(json: string, fileName: string): Promise<ExportResult> {
  if (isNative) return (await loadNative()).shareBackupFile(json, fileName, S.backup.shareTitle);
  downloadText(json, fileName);
  return 'downloaded';
}

export async function backupJson(repo: Repository, now: Date = new Date()): Promise<string> {
  return JSON.stringify(buildBackup(await repo.exportData(), now.toISOString()));
}

/**
 * Sur téléphone : partage (Drive, mail…) ; ailleurs ou à défaut : téléchargement.
 * Ne renvoie « cancelled » que si l'utilisateur ferme la feuille de partage.
 */
export async function exportBackup(repo: Repository): Promise<ExportResult> {
  const now = new Date();
  const json = await backupJson(repo, now);
  const name = backupFileName(todayIso(now));
  if (isNative) return saveJsonFile(json, name);
  const file = new File([json], name, { type: 'application/json' });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Partage refusé par le système : on retombe sur le téléchargement.
    }
  }
  downloadText(json, name);
  return 'downloaded';
}

export const AUTO_BACKUP_AT = 'autoBackupAt';
export const AUTO_BACKUP_PATH = 'autoBackupPath';
export const AUTO_BACKUP_ERROR = 'autoBackupError';

/**
 * Application Android : copie automatique dans Documents/CycleDeForce (au plus toutes les 2 minutes).
 * Sans effet dans le navigateur. `force` ignore l'intervalle minimal.
 */
export async function runAutoBackup(repo: Repository, force = false): Promise<void> {
  if (!isNative) return;
  const now = new Date();
  if (!force && !isAutoBackupDue(await repo.getFlag(AUTO_BACKUP_AT), now.getTime(), AUTO_BACKUP_MIN_INTERVAL_MS)) return;
  try {
    const path = await (await loadNative()).writeAutoBackup(await backupJson(repo, now), now);
    await repo.setFlag(AUTO_BACKUP_AT, now.toISOString());
    await repo.setFlag(AUTO_BACKUP_PATH, path);
    await repo.setFlag(AUTO_BACKUP_ERROR, '');
  } catch (err) {
    console.error(err);
    await repo.setFlag(AUTO_BACKUP_ERROR, String(err instanceof Error ? err.message : err));
  }
}
