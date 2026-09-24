import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { session, set, fixed } from '../domain/testUtils';
import { openRepository } from './repository';
import type { Repository } from './repository';

let repo: Repository | undefined;
let n = 0;
const fresh = async () => (repo = await openRepository(`test-${++n}`));

afterEach(() => repo?.close());

describe('repository IndexedDB', () => {
  it('charge les 5 modèles natifs une seule fois', async () => {
    const r = await fresh();
    expect(await r.ensureSeeded()).toEqual({ seeded: true });
    expect(await r.listTemplates()).toHaveLength(5);
    expect((await r.listExercises()).length).toBeGreaterThan(30);
    expect(await r.ensureSeeded()).toEqual({ seeded: false });
  });

  it('ne réécrase pas un modèle natif modifié', async () => {
    const r = await fresh();
    await r.ensureSeeded();
    const t = await r.getTemplate('tpl-deadlift');
    await r.saveTemplate({ ...t!, name: 'Deadlift perso' });
    await r.ensureSeeded();
    expect((await r.getTemplate('tpl-deadlift'))?.name).toBe('Deadlift perso');
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
