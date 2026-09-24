import type { Repository } from '../data/repository';
import { backupFileName, buildBackup } from '../domain/backup';
import { todayIso } from '../domain/dates';

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

export function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function backupJson(repo: Repository, now: Date = new Date()): Promise<string> {
  return JSON.stringify(buildBackup(await repo.exportData(), now.toISOString()));
}

/**
 * Sur téléphone : partage natif (Drive, mail…) ; ailleurs ou à défaut : téléchargement.
 * Ne renvoie « cancelled » que si l'utilisateur ferme la feuille de partage.
 */
export async function exportBackup(repo: Repository): Promise<ExportResult> {
  const now = new Date();
  const json = await backupJson(repo, now);
  const name = backupFileName(todayIso(now));
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
