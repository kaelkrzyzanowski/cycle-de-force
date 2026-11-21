import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from '../domain/backup';
import { OFFICIAL_EXERCISES, seedData } from '../seed';
import { session, set, fixed } from '../domain/testUtils';
import type { Session, SessionTemplate } from '../domain/types';
import { openCdfDb } from './db';
import { openRepository } from './repository';
import type { Repository } from './repository';

let repo: Repository | undefined;
let n = 0;
const fresh = async () => (repo = await openRepository(`test-${++n}`));

afterEach(() => repo?.close());

describe('repository IndexedDB', () => {
  it('nouvelle installation : aucun modèle, aucun cycle, catalogue d’exercices classé', async () => {
    const r = await fresh();
    expect(await r.ensureSeeded()).toEqual({ seeded: true });
    expect(await r.listTemplates()).toEqual([]);
    expect(await r.listCycles()).toEqual([]);
    const catalogue = await r.listExercises();
    expect(catalogue).toHaveLength(OFFICIAL_EXERCISES.length);
    expect(catalogue.every((e) => e.category !== undefined)).toBe(true);
    expect(await r.ensureSeeded()).toEqual({ seeded: false });
  });

  it('GARANTIE : une mise à jour (base v3, seed 2) ne modifie jamais un modèle, un cycle ni une séance', async () => {
    const name = `test-${++n}`;
    // Base telle qu'elle était sur le téléphone avant la mise à jour.
    const { templates, exercises } = seedData();
    const mine = templates.map((t) => (t.id === 'tpl-deadlift' ? { ...t, name: 'Deadlift perso', weeks: { ...t.weeks, 1: [] } } : t));
    const custom = { id: 'tpl-perso', name: 'Haut du corps', color: '#123456', native: false, weeksCount: 1, weeks: { 1: [] } };
    const cycle = { id: 'c1', name: 'Bloc 1', startDate: '2026-11-02', weeksCount: 7, max: { S: 180, B: 120, D: 220 }, weeklyPlan: [] };
    const old = await openCdfDb(name, 3);
    for (const t of [...mine, custom]) await old.put('templates', t);
    for (const e of exercises) await old.put('exercises', e);
    await old.put('cycles', cycle);
    await old.put('sessions', session('2026-11-03', [set(0, 5, fixed(100))], 's1'));
    await old.put('meta', { key: 'seedVersion', value: 2 });
    old.close();

    const r = (repo = await openRepository(name));
    expect(await r.ensureSeeded()).toEqual({ seeded: true });
    const after = await r.listTemplates();
    expect(after.sort((a, b) => a.id.localeCompare(b.id))).toEqual([...mine, custom].sort((a, b) => a.id.localeCompare(b.id)));
    expect(await r.listCycles()).toEqual([cycle]);
    expect(await r.getSession('s1')).toEqual(session('2026-11-03', [set(0, 5, fixed(100))], 's1'));
    // Exercices existants : seulement classés, noms et mouvements intacts ; catalogue de base ajouté.
    const catalogue = await r.listExercises();
    expect(catalogue.find((e) => e.id === 'squat')).toMatchObject({ name: 'Squat', defaultLift: 'S', category: 'libre' });
    expect(catalogue.length).toBeGreaterThan(exercises.length);
  });

  it('import de modèles : ajout atomique des modèles et des exercices', async () => {
    const r = await fresh();
    await r.ensureSeeded();
    const { templates, exercises } = seedData();
    await r.addTemplates(templates, exercises);
    expect(await r.listTemplates()).toHaveLength(5);
    await expect(r.addTemplates([{ id: undefined } as unknown as SessionTemplate], [])).rejects.toThrow();
    expect(await r.listTemplates()).toHaveLength(5);
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
    await r.ensureSeeded();
    await r.saveSettings({ ...(await r.getSettings()), rounding: 2.5, lastBackupAt: '2026-09-20T08:00:00.000Z' });
    await r.applyChanges({
      saveCycles: [{ id: 'c1', name: 'Bloc 0', startDate: '2026-09-21', weeksCount: 7, max: { S: 170, B: 115, D: 210 }, weeklyPlan: [] }],
      saveSessions: [
        session('2026-09-22', [{ ...set(0, 4, fixed(147)), status: 'FAILED', actualReps: 3, actualKg: 168 }], 'a'),
        session('2026-09-24', [set(0, 5, fixed(100))], 'b'),
      ],
      addMaxChanges: [{ id: 'm1', cycleId: 'c1', lift: 'D', from: 210, to: 215, at: '2026-09-24T10:00:00Z' }],
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
    await r.ensureSeeded();
    const before = await r.exportData();
    const bad = { ...before, sessions: [{ id: undefined } as unknown as Session] };
    await expect(r.replaceAll(bad, 'x')).rejects.toThrow();
    expect(await r.exportData()).toEqual(before);
    expect(await r.getPreRestoreBackup()).toBeUndefined();
  });

  it('pas par jour : écriture, lecture par période, export', async () => {
    const r = await fresh();
    await r.saveSteps([
      { date: '2026-11-02', steps: 8000 },
      { date: '2026-11-03', steps: 4200 },
    ]);
    await r.saveSteps([{ date: '2026-11-03', steps: 6100 }]);
    expect(await r.listStepsBetween('2026-11-03', '2026-11-30')).toEqual([{ date: '2026-11-03', steps: 6100 }]);
    expect((await r.exportData()).steps).toHaveLength(2);
  });

  it('journal calorique : un jour vide est supprimé, aliments personnalisés exportés', async () => {
    const r = await fresh();
    const meals = { matin: [], midi: [{ id: 'a', foodId: null, name: 'Pizza', kcal: 800 }], soir: [], col1: [], col2: [] };
    await r.saveFoodDay({ date: '2026-11-07', meals });
    expect(await r.listFoodDays('2026-11-01', '2026-11-30')).toHaveLength(1);
    await r.saveFoodDay({ date: '2026-11-07', meals: { ...meals, midi: [] } });
    expect(await r.listFoodDays('2026-11-01', '2026-11-30')).toEqual([]);
    await r.saveCustomFood({ id: 'cf1', name: 'Galette', category: 'feculents', cru: 200, custom: true });
    expect((await r.exportData()).customFoods).toHaveLength(1);
    await r.deleteCustomFood('cf1');
    expect(await r.listCustomFoods()).toEqual([]);
  });

  it('drapeaux', async () => {
    const r = await fresh();
    expect(await r.getFlag('exampleOffer')).toBeUndefined();
    await r.setFlag('exampleOffer', 'dismissed');
    expect(await r.getFlag('exampleOffer')).toBe('dismissed');
  });

  it('journal des max trié par date', async () => {
    const r = await fresh();
    await r.addMaxChanges([
      { id: '2', cycleId: 'c1', lift: 'D', from: 210, to: 215, at: '2026-10-01T00:00:00Z' },
      { id: '1', cycleId: 'c1', lift: 'S', from: 170, to: 172.5, at: '2026-09-25T00:00:00Z' },
      { id: '3', cycleId: 'c2', lift: 'B', from: 115, to: 117.5, at: '2026-11-01T00:00:00Z' },
    ]);
    expect((await r.listMaxChanges('c1')).map((c) => c.id)).toEqual(['1', '2']);
    expect(await r.listMaxChanges()).toHaveLength(3);
  });
});
