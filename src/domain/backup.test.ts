import { describe, expect, it } from 'vitest';
import { exampleCycle, seedData } from '../seed';
import { BACKUP_MIGRATIONS, buildBackup, parseBackup } from './backup';
import type { BackupData } from './backup';
import { generateCycleSessions } from './cycles';
import { recordSet, validateSet } from './sets';
import { DEFAULT_SETTINGS } from './types';
import type { Activity } from './types';

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
  const activities: Activity[] = [
    { id: 'a1', type: 'RUNNING', date: '2026-09-22', distanceKm: 8.4, durationSec: 2520 },
    { id: 'a2', type: 'WALKING', date: '2026-09-23', distanceKm: 0.01, durationSec: 10, track: [{ lat: 48.1, lon: 2.1, t: 1, seg: 0 }] },
  ];
  return {
    settings: { ...DEFAULT_SETTINGS, lastBackupAt: '2026-09-20T08:00:00.000Z' },
    templates,
    exercises,
    cycles: [cycle],
    sessions,
    maxChanges: [{ id: 'm1', cycleId: 'c0', lift: 'D', from: 210, to: 215, at: '2026-09-24T10:00:00Z' }],
    activities,
    steps: [{ date: '2026-09-22', steps: 9876 }],
  };
}

describe('format de sauvegarde', () => {
  const data = sampleData();
  const file = buildBackup(data, '2026-09-24T12:00:00.000Z');

  it('porte un en-tête avec les comptes', () => {
    expect(file).toMatchObject({ app: 'cycle-de-force', schemaVersion: 3, exportedAt: '2026-09-24T12:00:00.000Z' });
    expect(file.counts).toEqual({ cycles: 1, sessions: 28, realizedSets: 2, templates: 5, exercises: 40, maxChanges: 1, activities: 2 });
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
    v1.schemaVersion = 1;
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

  it('migre un fichier v1 (sans activités) vers v2 avec une liste vide', () => {
    const v1 = structuredClone(file) as unknown as { schemaVersion: number; data: Record<string, unknown> };
    v1.schemaVersion = 1;
    delete v1.data['activities'];
    const parsed = parseBackup(JSON.stringify(v1), { currentVersion: 2, migrations: BACKUP_MIGRATIONS });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.migratedFrom).toBe(1);
      expect(parsed.backup.data.activities).toEqual([]);
    }
  });

  it('migre un fichier v2 (sans pas) vers v3 avec une liste vide', () => {
    const v2 = structuredClone(file) as unknown as { schemaVersion: number; data: Record<string, unknown> };
    v2.schemaVersion = 2;
    delete v2.data['steps'];
    const parsed = parseBackup(JSON.stringify(v2));
    expect(parsed.ok && parsed.backup.data.steps).toEqual([]);
  });

  it('refuse un tracé GPS ou des pas invalides', () => {
    const badTrack = structuredClone(file) as unknown as { data: { activities: Record<string, unknown>[] } };
    badTrack.data.activities[1]!['track'] = [{ lat: 'nord', lon: 2, t: 1, seg: 0 }];
    expect(parseBackup(JSON.stringify(badTrack))).toMatchObject({ ok: false, error: 'INVALID' });
    const badSteps = structuredClone(file) as unknown as { data: { steps: unknown[] } };
    badSteps.data.steps = [{ date: '22/09', steps: 10 }];
    expect(parseBackup(JSON.stringify(badSteps))).toMatchObject({ ok: false, error: 'INVALID' });
  });

  it('refuse une activité invalide', () => {
    const zeroDistance = structuredClone(file);
    zeroDistance.data.activities = [{ id: 'a2', type: 'RUNNING', date: '2026-09-22', distanceKm: 0, durationSec: 60 }];
    expect(parseBackup(JSON.stringify(zeroDistance))).toMatchObject({ ok: false, error: 'INVALID' });

    const unknownType = structuredClone(file) as unknown as { data: { activities: Record<string, unknown>[] } };
    unknownType.data.activities = [{ id: 'a3', type: 'SKI', date: '2026-09-22', distanceKm: 5, durationSec: 60 }];
    expect(parseBackup(JSON.stringify(unknownType))).toMatchObject({ ok: false, error: 'INVALID' });
  });
});
