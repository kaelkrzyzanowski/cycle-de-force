import { useApp } from '../context';
import { exportBackup } from '../backupIO';
import { S } from '../strings';

const DAY = 86_400_000;

/** Nombre de jours depuis la dernière sauvegarde, ou null s'il n'y en a jamais eu. */
export function daysSinceBackup(lastBackupAt: string | undefined, now: number = Date.now()): number | null {
  if (!lastBackupAt) return null;
  return Math.floor((now - Date.parse(lastBackupAt)) / DAY);
}

export async function runExport(app: ReturnType<typeof useApp>): Promise<void> {
  const result = await exportBackup(app.repo);
  if (result === 'cancelled') return;
  await app.updateSettings({ lastBackupAt: new Date().toISOString() });
  app.toast(result === 'shared' ? S.backup.shared : S.backup.exported);
}

/** Bandeau discret si aucune sauvegarde depuis `backupReminderDays` jours. */
export function BackupReminder({ hasData }: { hasData: boolean }) {
  const app = useApp();
  const days = daysSinceBackup(app.settings.lastBackupAt);
  const due = days === null ? hasData : days >= app.settings.backupReminderDays;
  if (!due) return null;
  return (
    <section class="reminder" role="note">
      <span>{S.backup.reminder(days)}</span>
      <button type="button" class="btn small" onClick={() => void runExport(app)}>
        {S.backup.saveNow}
      </button>
    </section>
  );
}
