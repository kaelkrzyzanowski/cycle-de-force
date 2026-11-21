import { useRef, useState } from 'preact/hooks';
import { parseTemplatesFile, templatesToImport } from '../../domain/templatesFile';
import type { TemplatesParseError } from '../../domain/templatesFile';
import type { Exercise, SessionTemplate } from '../../domain/types';
import { isNative } from '../../platform';
import { exportTemplates } from '../backupIO';
import { useApp } from '../context';
import { S } from '../strings';
import { Sheet } from './Sheet';

type Preview = { add: SessionTemplate[]; skipped: SessionTemplate[]; exercises: Exercise[] } | { error: TemplatesParseError };

/** Exporter tous les modèles dans un fichier, ou en importer (sans remplacer ceux déjà présents). */
export function TemplatesTransfer({ templates }: { templates: readonly SessionTemplate[] }) {
  const app = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    try {
      if ((await exportTemplates(app.repo, templates)) === 'downloaded') app.toast(S.templatesFile.exported(templates.length));
    } catch (err) {
      console.error(err);
      app.toast(S.templatesFile.exportError);
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseTemplatesFile(await file.text());
    if (input.current) input.current.value = '';
    if (!parsed.ok) {
      setPreview({ error: parsed.error });
      return;
    }
    const catalogue = await app.repo.listExercises();
    const plan = templatesToImport(parsed.file, new Set(templates.map((t) => t.id)), new Set(catalogue.map((e) => e.id)));
    setPreview({ add: plan.templates, skipped: plan.skipped, exercises: plan.exercises });
  };

  const confirm = async (add: SessionTemplate[], exercises: Exercise[]) => {
    setBusy(true);
    try {
      await app.repo.addTemplates(add, exercises);
      app.refresh();
      app.toast(S.templatesFile.imported(add.length));
      setPreview(null);
    } catch (err) {
      console.error(err);
      app.toast(S.saveError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="card stack tight">
      <h2 class="card-title">{S.templatesFile.title}</h2>
      <p class="muted">{S.templatesFile.hint}</p>
      <div class="button-row">
        <button type="button" class="btn" disabled={templates.length === 0} onClick={() => void exportAll()}>
          {S.templatesFile.exportAll}
        </button>
        <button type="button" class="btn" onClick={() => input.current?.click()}>
          {S.templatesFile.import}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        // Dans l'app Android, pas de filtre : Drive présente souvent le JSON comme un fichier générique.
        accept={isNative ? undefined : 'application/json,.json'}
        class="sr-only"
        aria-label={S.templatesFile.import}
        tabIndex={-1}
        onChange={(e) => void pick(e.currentTarget.files?.[0])}
      />
      {preview && (
        <Sheet title={S.templatesFile.importTitle} onClose={() => setPreview(null)}>
          {'error' in preview ? (
            <p class="warning" role="alert">
              {S.templatesFile.errors[preview.error]}
            </p>
          ) : (
            <div class="stack">
              {preview.add.length > 0 ? (
                <>
                  <p>{S.templatesFile.toAdd(preview.add.length)}</p>
                  <ul class="import-list">
                    {preview.add.map((t) => (
                      <li key={t.id}>{t.name}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>{S.templatesFile.nothingNew}</p>
              )}
              {preview.skipped.length > 0 && (
                <p class="muted">{S.templatesFile.skipped(preview.skipped.map((t) => t.name).join(', '))}</p>
              )}
              <p class="muted">{S.templatesFile.safe}</p>
              <div class="button-row">
                <button type="button" class="btn" onClick={() => setPreview(null)}>
                  {S.common.cancel}
                </button>
                <button
                  type="button"
                  class="btn primary"
                  disabled={busy || preview.add.length === 0}
                  onClick={() => void confirm(preview.add, preview.exercises)}
                >
                  {S.templatesFile.confirm}
                </button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </section>
  );
}
