import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from '../domain/backup';
import { exampleProgram } from '../fixtures';
import { session, set, fixed } from '../domain/testUtils';
import type { Session } from '../domain/types';
import { openCdfDb } from './db';
import { openRepository } from './repository';
import type { Repository } from './repository';

let repo: Repository | undefined;
let n = 0;
const fresh = async () => (repo = await openRepository(`test-${++n}`));

afterEach(() => repo?.close());

/** Remplit la base avec le programme d'exemple des tests. */
async function withExample(r: Repository) {
  const { templates, exercises } = exampleProgram();
  for (const t of templates) await r.saveTemplate(t);
  for (const e of exercises) await r.saveExercise(e);
}

describe('repository IndexedDB', () => {
  it('démarre vierge : aucun modèle, exercice ni cycle', async () => {
    const r = await fresh();
    expect(await r.listTemplates()).toEqual([]);
    expect(await r.listExercises()).toEqual([]);
    expect(await r.listCycles()).toEqual([]);
  });

  it('réglages par défaut puis enregistrés', async () => {
    const r = await fresh();
    expect(await r.getSettings()).toMatchObject({ rounding: 1, theme: 'dark', backupReminderDays: 7 });
    await r.saveSettings({ ...(await r.getSettings()), rounding: 2.5 });
    expect((await r.getSettings()).rounding).toBe(2.5);
  });

  it('séances par période et par cycle', async () => {
    const r = await fresh();
    await r.saveSessions([
      session('2026-09-29', [set(0, 5, fixed(100))], 'b'),
      session('2026-09-22', [set(0, 5, fixed(100))], 'a'),
      { ...session('2026-10-20', [], 'c'), cycleId: null },
    ]);
    expect((await r.listSessionsBetween('2026-09-21', '2026-09-30')).map((s) => s.id)).toEqual(['a', 'b']);
    expect((await r.listSessionsByCycle('c1')).map((s) => s.id)).toEqual(['a', 'b']);
    await r.deleteSession('a');
    expect(await r.getSession('a')).toBeUndefined();
  });

  it('écritures groupées atomiques : une erreur annule tout', async () => {
    const r = await fresh();
    const a = session('2026-09-22', [set(0, 5, fixed(100))], 'a');
    await r.saveSessions([a]);
    await r.applyChanges({
      saveCycles: [{ id: 'c1', name: 'Bloc', startDate: '2026-09-21', weeksCount: 7, max: { S: 1, B: 1, D: 1 }, weeklyPlan: [] }],
      saveSessions: [session('2026-09-23', [], 'b')],
      deleteSessionIds: ['a'],
    });
    expect((await r.listSessionsByCycle('c1')).map((s) => s.id)).toEqual(['b']);
    expect(await r.getCycle('c1')).toBeDefined();

    const invalid = { ...session('2026-09-24', [], 'c'), id: undefined } as unknown as ReturnType<typeof session>;
    await expect(r.applyChanges({ deleteSessionIds: ['b'], saveSessions: [invalid] })).rejects.toThrow();
    expect(await r.getSession('b')).toBeDefined();
  });

  it('export puis restauration dans une base vidée = base identique', async () => {
    const r = await fresh();
    await withExample(r);
    await r.saveSettings({ ...(await r.getSettings()), rounding: 2.5, lastBackupAt: '2026-09-20T08:00:00.000Z' });
    await r.applyChanges({
      saveCycles: [{ id: 'c1', name: 'Bloc 0', startDate: '2026-09-21', weeksCount: 7, max: { S: 170, B: 115, D: 210 }, weeklyPlan: [] }],
      saveSessions: [
        session('2026-09-22', [{ ...set(0, 4, fixed(147)), status: 'FAILED', actualReps: 3, actualKg: 168 }], 'a'),
        session('2026-09-24', [set(0, 5, fixed(100))], 'b'),
      ],
      addMaxChanges: [{ id: 'm1', cycleId: 'c1', exerciseId: 'D', from: 210, to: 215, at: '2026-09-24T10:00:00Z' }],
    });
    const before = await r.exportData();
    const json = JSON.stringify(buildBackup(before, '2026-09-24T12:00:00Z'));

    // « Vider les données du site » : une base neuve.
    const empty = await openRepository(`test-${++n}`);
    const parsed = parseBackup(json);
    if (!parsed.ok) throw new Error(parsed.error);
    await empty.replaceAll(parsed.backup.data, '{"avant":true}');
    expect(await empty.exportData()).toEqual(before);
    expect(await empty.getPreRestoreBackup()).toBe('{"avant":true}');
    empty.close();
  });

  it('restauration atomique : en cas d’erreur, rien n’est modifié', async () => {
    const r = await fresh();
    await withExample(r);
    const before = await r.exportData();
    const bad = { ...before, sessions: [{ id: undefined } as unknown as Session] };
    await expect(r.replaceAll(bad, 'x')).rejects.toThrow();
    expect(await r.exportData()).toEqual(before);
    expect(await r.getPreRestoreBackup()).toBeUndefined();
  });

  it('drapeaux', async () => {
    const r = await fresh();
    expect(await r.getFlag('exampleOffer')).toBeUndefined();
    await r.setFlag('exampleOffer', 'dismissed');
    expect(await r.getFlag('exampleOffer')).toBe('dismissed');
  });

  it('migration de la base v1 (RM limités à S/B/D) vers le RM par exercice', async () => {
    const name = `test-${++n}`;
    const v1 = await openCdfDb(name, 1);
    const load = { kind: 'PERCENT', lift: 'B', pct: 0.7 };
    const put = (store: string, value: unknown) => v1.put(store as 'cycles', value as never);
    await put('cycles', { id: 'c0', name: 'Bloc 0', startDate: '2026-09-21', weeksCount: 7, max: { S: 170, B: 115, D: 210 }, weeklyPlan: [] });
    await put('sessions', {
      ...session('2026-09-22', [{ index: 0, plannedReps: 5, status: 'PLANNED', load } as never], 's1'),
      cycleId: 'c0',
    });
    await put('templates', { id: 't1', name: 'Bench', color: '#000', native: false, weeksCount: 1, weeks: { 1: [{ exerciseId: 'dc', name: 'DC', sets: [{ reps: 5, load }] }] } });
    await put('maxChanges', { id: 'm1', cycleId: 'c0', lift: 'S', from: 165, to: 170, at: '2026-09-21T00:00:00Z' });
    await put('exercises', { id: 'dc', name: 'DC', aliases: [], defaultLift: 'B' });
    v1.close();

    const r = (repo = await openRepository(name));
    expect((await r.getCycle('c0'))?.max).toEqual({ squat: 170, 'developpe-couche': 115, 'souleve-de-terre': 210 });
    expect((await r.getSession('s1'))?.exercises[0]?.sets[0]?.load).toEqual({ kind: 'PERCENT', of: 'developpe-couche', pct: 0.7 });
    expect((await r.getTemplate('t1'))?.weeks[1]?.[0]?.sets[0]?.load).toEqual({ kind: 'PERCENT', of: 'developpe-couche', pct: 0.7 });
    expect((await r.listMaxChanges())[0]?.exerciseId).toBe('squat');
    const exercises = await r.listExercises();
    expect(exercises.find((e) => e.id === 'dc')).toEqual({ id: 'dc', name: 'DC', aliases: [], defaultMax: 'developpe-couche' });
    expect(exercises.filter((e) => e.hasMax).map((e) => e.id).sort()).toEqual(['developpe-couche', 'souleve-de-terre', 'squat']);
    // Le store des activités (v3) existe aussi après la réécriture des données (v2).
    expect(await r.listActivitiesBetween('2026-01-01', '2026-12-31')).toEqual([]);
    // L'exercice « x » de la séance a rejoint le catalogue.
    expect(exercises.some((e) => e.id === 'x')).toBe(true);
  });

  it('journal des max trié par date', async () => {
    const r = await fresh();
    await r.addMaxChanges([
      { id: '2', cycleId: 'c1', exerciseId: 'D', from: 210, to: 215, at: '2026-10-01T00:00:00Z' },
      { id: '1', cycleId: 'c1', exerciseId: 'S', from: 170, to: 172.5, at: '2026-09-25T00:00:00Z' },
      { id: '3', cycleId: 'c2', exerciseId: 'B', from: 115, to: 117.5, at: '2026-11-01T00:00:00Z' },
    ]);
    expect((await r.listMaxChanges('c1')).map((c) => c.id)).toEqual(['1', '2']);
    expect(await r.listMaxChanges()).toHaveLength(3);
  });
});
