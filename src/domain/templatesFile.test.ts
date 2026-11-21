import { describe, expect, it } from 'vitest';
import { seedData } from '../seed';
import { buildTemplatesFile, parseTemplatesFile, templatesFileName, templatesToImport } from './templatesFile';

const { templates, exercises } = seedData();
const extra = { id: 'ex-inutilise', name: 'Exercice non utilisé', aliases: [] };

describe('fichier de modèles', () => {
  const file = buildTemplatesFile(templates, [...exercises, extra], '2026-11-21T10:00:00.000Z');

  it('ne contient que les modèles et les exercices qu’ils utilisent', () => {
    expect(Object.keys(file).sort()).toEqual(['app', 'exercises', 'exportedAt', 'kind', 'templates', 'version']);
    expect(file.templates).toHaveLength(5);
    expect(file.exercises.map((e) => e.id)).not.toContain('ex-inutilise');
    expect(file.exercises.length).toBe(exercises.length);
  });

  it('aller-retour JSON identique ; refuse une sauvegarde complète, un autre fichier ou un modèle invalide', () => {
    const parsed = parseTemplatesFile(JSON.stringify(file));
    expect(parsed).toEqual({ ok: true, file });
    expect(parseTemplatesFile('{pas du json')).toEqual({ ok: false, error: 'NOT_JSON' });
    expect(parseTemplatesFile(JSON.stringify({ app: 'autre' }))).toEqual({ ok: false, error: 'WRONG_APP' });
    expect(parseTemplatesFile(JSON.stringify({ app: 'cycle-de-force', schemaVersion: 4, data: {} }))).toEqual({ ok: false, error: 'NOT_TEMPLATES' });
    expect(parseTemplatesFile(JSON.stringify({ ...file, version: 99 }))).toEqual({ ok: false, error: 'TOO_NEW' });
    const broken = structuredClone(file) as unknown as { templates: { weeksCount: unknown }[] };
    broken.templates[0]!.weeksCount = 'sept';
    expect(parseTemplatesFile(JSON.stringify(broken))).toEqual({ ok: false, error: 'INVALID' });
  });

  it('import : les modèles déjà présents ne sont pas remplacés, les autres sont ajoutés', () => {
    const plan = templatesToImport(file, new Set(['tpl-deadlift', 'tpl-bench']), new Set(['squat']));
    expect(plan.templates.map((t) => t.id)).toEqual(['tpl-sbd', 'tpl-squat', 'tpl-joker']);
    expect(plan.skipped.map((t) => t.id)).toEqual(['tpl-deadlift', 'tpl-bench']);
    expect(plan.exercises.map((e) => e.id)).not.toContain('squat');
  });

  it('noms de fichier', () => {
    expect(templatesFileName('2026-11-21')).toBe('modeles-2026-11-21.json');
    expect(templatesFileName('2026-11-21', 'Développé couché')).toBe('modele-developpe-couche-2026-11-21.json');
  });
});
