import { useRef, useState } from 'preact/hooks';
import { parseBackup } from '../../domain/backup';
import type { BackupFile, BackupError } from '../../domain/backup';
import { todayIso } from '../../domain/dates';
import { isNative } from '../../platform';
import { AUTO_BACKUP_AT, AUTO_BACKUP_ERROR, AUTO_BACKUP_PATH, backupJson, runAutoBackup, saveJsonFile } from '../backupIO';
import { useApp, useData } from '../context';
import { S } from '../strings';
import { runExport } from './BackupReminder';
import { NumberField } from './NumberField';
import { Sheet } from './Sheet';

const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
const when = (iso: string): string => (iso ? dateTime.format(new Date(iso)) : '?');

type Preview = { backup: BackupFile; migratedFrom: number | null } | { error: BackupError; detail?: string };

/** Réglages → Sauvegarde : exporter, restaurer avec aperçu, rappel. */
export function BackupSection() {
  const app = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const preRestore = useData((repo) => repo.getPreRestoreBackup(), []);
  const auto = useData(
    async (repo) => ({
      at: await repo.getFlag(AUTO_BACKUP_AT),
      path: await repo.getFlag(AUTO_BACKUP_PATH),
      error: await repo.getFlag(AUTO_BACKUP_ERROR),
    }),
    [],
  );
  const autoNow = async () => {
    await runAutoBackup(app.repo, true);
    app.refresh();
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const result = parseBackup(await file.text());
    setPreview(result.ok ? { backup: result.backup, migratedFrom: result.migratedFrom } : { error: result.error, detail: result.detail });
    if (input.current) input.current.value = '';
  };

  const restore = async (backup: BackupFile) => {
    setBusy(true);
    try {
      // Copie de l'état actuel, gardée en base avant d'écraser.
      const previous = await backupJson(app.repo);
      await app.repo.replaceAll(backup.data, previous);
      await app.reloadSettings();
      await runAutoBackup(app.repo, true);
      app.refresh();
      setPreview(null);
      app.toast(S.backup.restored);
    } catch (err) {
      console.error(err);
      app.toast(S.saveError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="card stack" aria-labelledby="backup-title">
      <h2 id="backup-title" class="card-title">
        {S.backup.title}
      </h2>
      <p class="muted">{app.settings.lastBackupAt ? S.backup.last(when(app.settings.lastBackupAt)) : S.backup.never}</p>
      <button type="button" class="btn primary" onClick={() => void runExport(app)}>
        {S.backup.export}
      </button>
      <button type="button" class="btn" onClick={() => input.current?.click()}>
        {S.backup.restore}
      </button>
      <input
        ref={input}
        type="file"
        // Dans l'app Android, pas de filtre : Drive présente souvent le JSON comme un fichier générique.
        accept={isNative ? undefined : 'application/json,.json'}
        class="sr-only"
        aria-label={S.backup.restore}
        tabIndex={-1}
        onChange={(e) => void pick(e.currentTarget.files?.[0])}
      />
      {preRestore && (
        <button type="button" class="btn small" onClick={() => void saveJsonFile(preRestore, `cycle-de-force-avant-restauration-${todayIso()}.json`)}>
          {S.backup.preRestore}
        </button>
      )}
      {isNative && (
        <div class="stack tight">
          <strong>{S.backup.autoTitle}</strong>
          <p class="muted">{S.backup.autoText}</p>
          <p>{auto?.at ? S.backup.autoLast(when(auto.at), auto.path ?? '') : S.backup.autoNever}</p>
          {auto?.error && <p class="warning">{S.backup.autoError(auto.error)}</p>}
          <button type="button" class="btn small" onClick={() => void autoNow()}>
            {S.backup.autoNow}
          </button>
        </div>
      )}
      <NumberField
        label={S.backup.reminderDays}
        value={app.settings.backupReminderDays}
        min={1}
        max={90}
        onChange={(v) => void app.updateSettings({ backupReminderDays: Math.round(v) })}
      />

      {preview && (
        <Sheet title={S.backup.restoreTitle} onClose={() => setPreview(null)}>
          {'error' in preview ? (
            <p class="warning" role="alert">
              {S.backup.errors[preview.error]}
              {preview.detail && <span class="muted"> ({preview.detail})</span>}
            </p>
          ) : (
            <div class="stack">
              <strong>{S.backup.preview(when(preview.backup.exportedAt))}</strong>
              <p>
                {S.backup.counts(
                  preview.backup.counts.cycles,
                  preview.backup.counts.sessions,
                  preview.backup.counts.realizedSets,
                )}
              </p>
              {preview.migratedFrom !== null && <p class="muted">{S.backup.migrated(preview.migratedFrom)}</p>}
              <p class="warning">{S.backup.warning}</p>
              <button type="button" class="btn danger" disabled={busy} onClick={() => void restore(preview.backup)}>
                {S.backup.confirm}
              </button>
            </div>
          )}
        </Sheet>
      )}
    </section>
  );
}
