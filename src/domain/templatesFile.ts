import { BACKUP_APP, checkTemplatesAndExercises } from './backup';
import { slugify } from './ids';
import type { Exercise, IsoDate, SessionTemplate } from './types';

/**
 * Fichier « modèles seuls » : les modèles tels qu'ils sont à l'instant T et les exercices qu'ils utilisent.
 * Ni séances, ni cycles, ni max, ni réglages.
 */
export const TEMPLATES_KIND = 'modeles';
export const TEMPLATES_FILE_VERSION = 1;

export interface TemplatesFile {
  app: typeof BACKUP_APP;
  kind: typeof TEMPLATES_KIND;
  version: number;
  exportedAt: string;
  templates: SessionTemplate[];
  exercises: Exercise[];
}

export function buildTemplatesFile(templates: readonly SessionTemplate[], catalogue: readonly Exercise[], exportedAt: string): TemplatesFile {
  const used = new Set(templates.flatMap((t) => Object.values(t.weeks).flatMap((w) => w.map((e) => e.exerciseId))));
  return {
    app: BACKUP_APP,
    kind: TEMPLATES_KIND,
    version: TEMPLATES_FILE_VERSION,
    exportedAt,
    templates: structuredClone([...templates]),
    exercises: catalogue.filter((e) => used.has(e.id)),
  };
}

/** « modeles-2026-11-21.json » ou « modele-bench-2026-11-21.json » pour un seul modèle. */
export function templatesFileName(date: IsoDate, single?: string): string {
  return single ? `modele-${slugify(single) || 'sans-nom'}-${date}.json` : `modeles-${date}.json`;
}

export type TemplatesParseError = 'NOT_JSON' | 'WRONG_APP' | 'NOT_TEMPLATES' | 'TOO_NEW' | 'INVALID';
export type TemplatesParseResult = { ok: true; file: TemplatesFile } | { ok: false; error: TemplatesParseError };

export function parseTemplatesFile(text: string): TemplatesParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'NOT_JSON' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'WRONG_APP' };
  const file = raw as Record<string, unknown>;
  if (file['app'] !== BACKUP_APP) return { ok: false, error: 'WRONG_APP' };
  if (file['kind'] !== TEMPLATES_KIND) return { ok: false, error: 'NOT_TEMPLATES' };
  if (typeof file['version'] !== 'number' || file['version'] > TEMPLATES_FILE_VERSION) return { ok: false, error: 'TOO_NEW' };
  try {
    checkTemplatesAndExercises(file);
  } catch {
    return { ok: false, error: 'INVALID' };
  }
  return { ok: true, file: file as unknown as TemplatesFile };
}

/** Import : les modèles et exercices déjà présents (même identifiant) ne sont pas remplacés, les autres sont ajoutés. */
export function templatesToImport(
  file: Pick<TemplatesFile, 'templates' | 'exercises'>,
  existingTemplateIds: ReadonlySet<string>,
  existingExerciseIds: ReadonlySet<string>,
): { templates: SessionTemplate[]; exercises: Exercise[]; skipped: SessionTemplate[] } {
  return {
    templates: file.templates.filter((t) => !existingTemplateIds.has(t.id)),
    skipped: file.templates.filter((t) => existingTemplateIds.has(t.id)),
    exercises: file.exercises.filter((e) => !existingExerciseIds.has(e.id)),
  };
}
