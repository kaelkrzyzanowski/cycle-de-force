import { describe, expect, it } from 'vitest';
import { exampleCycle, seedData } from '../seed';
import { buildBackup, parseBackup } from './backup';
import type { BackupData } from './backup';
import { generateCycleSessions } from './cycles';
import { recordSet, validateSet } from './sets';
import { DEFAULT_SETTINGS } from './types';

let n = 0;
const newId = () => `b${++n}`;

function sampleData(): BackupData {
  const { templates, exercises } = seedData();
  const cycle = exampleCycle('c0', '2026-09-21');
  const sessions = generateCycleSessions(cycle, new Map(templates.map((t) => [t.id, t])), newId);
  const first = sessions[0]!;
  const ex = first.exercises[0]!;
  ex.sets = [validateSet(ex.sets[0]!, cycle.max, 1), recordSet(ex.sets[1]!, 'FAILED', { reps: 3, kg: 168 }, cycle.max, 1)];
  ex.rir = 1;
  first.note = 'Dos un peu raide';
  return {
    settings: { ...DEFAULT_SETTINGS, lastBackupAt: '2026-09-20T08:00:00.000Z' },
    templates,
    exercises,
    cycles: [cycle],
    sessions,
    maxChanges: [{ id: 'm1', cycleId: 'c0', lift: 'D', from: 210, to: 215, at: '2026-09-24T10:00:00Z' }],
  };
}

describe('format de sauvegarde', () => {
  const data = sampleData();
  const file = buildBackup(data, '2026-09-24T12:00:00.000Z');

  it('porte un en-tête avec les comptes', () => {
    expect(file).toMatchObject({ app: 'cycle-de-force', schemaVersion: 1, exportedAt: '2026-09-24T12:00:00.000Z' });
    expect(file.counts).toEqual({ cycles: 1, sessions: 28, realizedSets: 2, templates: 5, exercises: 40, maxChanges: 1 });
  });

  it('JSON aller-retour = données identiques', () => {
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.data).toEqual(data);
      expect(parsed.migratedFrom).toBeNull();
    }
  });

  it('refuse un fichier corrompu, d’une autre app, ou plus récent', () => {
    expect(parseBackup('{pas du json')).toEqual({ ok: false, error: 'NOT_JSON' });
    expect(parseBackup(JSON.stringify({ app: 'autre', schemaVersion: 1 }))).toEqual({ ok: false, error: 'WRONG_APP' });
    expect(parseBackup(JSON.stringify({ ...file, schemaVersion: 99 }))).toEqual({ ok: false, error: 'TOO_NEW' });

    const broken = structuredClone(file);
    (broken.data.sessions[0]!.exercises[0]!.sets[0] as { status: string }).status = 'BIZARRE';
    expect(parseBackup(JSON.stringify(broken))).toMatchObject({ ok: false, error: 'INVALID' });

    const noSessions = structuredClone(file) as unknown as { data: Record<string, unknown> };
    delete noSessions.data['sessions'];
    expect(parseBackup(JSON.stringify(noSessions))).toMatchObject({ ok: false, error: 'INVALID', detail: 'sessions manquant' });
  });

  it('migre un fichier d’une version plus ancienne', () => {
    // Version 1 fictive où les max étaient rangés sous « maxes » et le journal absent.
    const v1 = structuredClone(file) as unknown as { schemaVersion: number; data: Record<string, unknown> };
    const cycles = (v1.data['cycles'] as Record<string, unknown>[]).map(({ max, ...c }) => ({ ...c, maxes: max }));
    v1.data = { ...v1.data, cycles };
    delete v1.data['maxChanges'];

    const migrations = {
      2: (f: Record<string, unknown>) => {
        const d = f['data'] as Record<string, unknown>;
        const migrated = (d['cycles'] as Record<string, unknown>[]).map(({ maxes, ...c }) => ({ ...c, max: maxes }));
        return { ...f, data: { ...d, cycles: migrated, maxChanges: [] } };
      },
    };
    const parsed = parseBackup(JSON.stringify(v1), { currentVersion: 2, migrations });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.migratedFrom).toBe(1);
      expect(parsed.backup.schemaVersion).toBe(2);
      expect(parsed.backup.data.cycles[0]?.max).toEqual({ S: 170, B: 115, D: 210 });
      expect(parsed.backup.data.maxChanges).toEqual([]);
    }
    // Sans la migration, le fichier est refusé plutôt que chargé à moitié.
    expect(parseBackup(JSON.stringify(v1), { currentVersion: 2, migrations: {} })).toMatchObject({ ok: false, error: 'INVALID' });
  });

  it('complète les réglages manquants avec les valeurs par défaut', () => {
    const partial = structuredClone(file) as unknown as { data: { settings: Record<string, unknown> } };
    partial.data.settings = { rounding: 2.5 };
    const parsed = parseBackup(JSON.stringify(partial));
    expect(parsed.ok && parsed.backup.data.settings).toEqual({ ...DEFAULT_SETTINGS, rounding: 2.5 });
  });
});
