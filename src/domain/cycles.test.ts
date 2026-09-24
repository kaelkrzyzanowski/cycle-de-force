import { describe, expect, it } from 'vitest';
import { exampleCycle, nativeTemplates, TEMPLATE_IDS } from '../seed';
import {
  conflictDates,
  cycleEndDate,
  cycleWeekOf,
  duplicateCycle,
  duplicateWeek,
  findCycleForDate,
  generateCycleSessions,
  moveSession,
  resolveConflicts,
  sessionFromTemplate,
  templateWeek,
} from './cycles';
import { isoWeekday } from './dates';
import { displayKg } from './load';
import { recordSet, validateSet } from './sets';
import type { Session } from './types';

const templates = new Map(nativeTemplates().map((t) => [t.id, t]));
let n = 0;
const counter = () => () => `id${++n}`;
const bloc0 = exampleCycle('c0', '2026-09-21');

describe('semaines de cycle', () => {
  it('calcule la semaine et la fin du cycle', () => {
    expect(cycleWeekOf(bloc0, '2026-09-20')).toBeNull();
    expect(cycleWeekOf(bloc0, '2026-09-21')).toBe(1);
    expect(cycleWeekOf(bloc0, '2026-09-28')).toBe(2);
    expect(cycleEndDate(bloc0)).toBe('2026-11-08');
    expect(cycleWeekOf(bloc0, '2026-11-08')).toBe(7);
    expect(cycleWeekOf(bloc0, '2026-11-09')).toBeNull();
  });
  it('au-delà des semaines du modèle, reprend la dernière', () => {
    const t = templates.get(TEMPLATE_IDS.deadlift)!;
    expect(templateWeek(t, 9)).toEqual(t.weeks[7]);
  });
  it('trouve le cycle le plus récent en cas de chevauchement', () => {
    const later = { ...bloc0, id: 'c1', startDate: '2026-10-05' };
    expect(findCycleForDate([bloc0, later], '2026-10-06')?.id).toBe('c1');
    expect(findCycleForDate([bloc0, later], '2026-09-22')?.id).toBe('c0');
  });
});

describe('génération du cycle Bloc 0', () => {
  const sessions = generateCycleSessions(bloc0, templates, counter());

  it('crée 28 séances aux bons jours sur 7 semaines', () => {
    expect(sessions).toHaveLength(28);
    expect(sessions.slice(0, 4).map((s) => [s.date, s.name])).toEqual([
      ['2026-09-22', 'Deadlift'],
      ['2026-09-24', 'SBD'],
      ['2026-09-26', 'Bench'],
      ['2026-09-27', 'Squat'],
    ]);
    expect(sessions.at(-1)?.date).toBe('2026-11-08');
    expect(new Set(sessions.map((s) => isoWeekday(s.date)))).toEqual(new Set([2, 4, 6, 7]));
    expect(sessions.every((s) => s.cycleId === 'c0')).toBe(true);
  });

  it('chaque séance porte la prescription de sa semaine', () => {
    const dl1 = sessions[0]!;
    expect(dl1.cycleWeek).toBe(1);
    const first = dl1.exercises[0]!;
    expect(first.name).toBe("Deadlift Sumo 2''+ iso");
    expect(displayKg(first.sets[0]!, bloc0.max, 1)).toBe(147);
    const dl5 = sessions.find((s) => s.name === 'Deadlift' && s.cycleWeek === 5)!;
    expect(dl5.exercises[0]?.name).toBe('Squat Sumo');
    expect(sessions.flatMap((s) => s.exercises.flatMap((e) => e.sets)).every((x) => x.status === 'PLANNED')).toBe(true);
  });

  it('copie la prescription : modifier la séance ne touche pas le modèle', () => {
    const t = templates.get(TEMPLATE_IDS.sbd)!;
    const s = sessionFromTemplate(t, 1, { date: '2026-09-24', cycleId: null, cycleWeek: null }, counter());
    s.exercises[0]!.sets[0]!.plannedReps = 99;
    expect(t.weeks[1]?.[0]?.sets[0]?.reps).toBe(4); // Squat 420 3×4
  });
});

/** Semaine 2 du Bloc 0 avec des séries réalisées et une modification manuelle. */
function workedWeek2(): Session[] {
  const all = generateCycleSessions(bloc0, templates, counter());
  return all
    .filter((s) => s.cycleWeek === 2)
    .map((s, i) => {
      if (i !== 0) return s;
      const ex = s.exercises[0]!;
      return {
        ...s,
        rir: 2,
        note: 'Bonne séance',
        exercises: [
          {
            ...ex,
            name: 'Deadlift modifié',
            rir: 1,
            sets: [validateSet(ex.sets[0]!, bloc0.max, 1), recordSet(ex.sets[1]!, 'FAILED', { reps: 2 }, bloc0.max, 1)],
          },
        ],
      };
    });
}

describe('dupliquer une semaine', () => {
  const source = workedWeek2();

  it('copie telle quelle vers une date libre, jours conservés, tout en PLANNED', () => {
    const copies = duplicateWeek(
      {
        sessions: source,
        sourceMonday: '2026-09-28',
        targetMonday: '2026-11-16',
        mode: 'AS_IS',
        templateWeek: 2,
        templates,
        cycles: [bloc0],
      },
      counter(),
    );
    expect(copies.map((s) => s.date)).toEqual(['2026-11-17', '2026-11-19', '2026-11-21', '2026-11-22']);
    expect(copies[0]?.exercises).toHaveLength(1);
    expect(copies[0]?.exercises[0]?.name).toBe('Deadlift modifié');
    expect(copies[0]?.rir).toBeUndefined();
    expect(copies[0]?.note).toBeUndefined();
    expect(copies[0]?.exercises[0]?.rir).toBeUndefined();
    const sets = copies.flatMap((s) => s.exercises.flatMap((e) => e.sets));
    expect(sets.every((x) => x.status === 'PLANNED' && x.actualKg === undefined && x.actualReps === undefined)).toBe(true);
    // Hors cycle : plus de rattachement.
    expect(copies.every((s) => s.cycleId === null && s.cycleWeek === null)).toBe(true);
    // Nouveaux identifiants.
    expect(copies.some((c) => source.some((s) => s.id === c.id))).toBe(false);
  });

  it('reprend la prescription de la semaine k du modèle, rattachée au cycle cible', () => {
    const copies = duplicateWeek(
      {
        sessions: source,
        sourceMonday: '2026-09-28',
        targetMonday: '2026-10-05',
        mode: 'TEMPLATE',
        templateWeek: 3,
        templates,
        cycles: [bloc0],
      },
      counter(),
    );
    expect(copies[0]?.exercises[0]?.name).toBe("Deadlift Sumo 2''+ iso");
    expect(copies[0]?.exercises[1]?.sets.map((s) => s.plannedReps)).toEqual([4, 3, 3, 3]); // S3
    expect(copies.every((s) => s.cycleId === 'c0' && s.cycleWeek === 3)).toBe(true);
  });

  it('ignore les séances hors de la semaine source', () => {
    const all = generateCycleSessions(bloc0, templates, counter());
    const copies = duplicateWeek(
      { sessions: all, sourceMonday: '2026-09-28', targetMonday: '2026-11-16', mode: 'AS_IS', templateWeek: 1, templates, cycles: [] },
      counter(),
    );
    expect(copies).toHaveLength(4);
  });
});

describe('dupliquer un cycle', () => {
  const source = generateCycleSessions(bloc0, templates, counter());
  source[0] = workedWeek2()[0]!; // une séance modifiée et entamée (semaine 2)

  it('crée un cycle indépendant avec Deadlift +5 kg, séances remises en PLANNED', () => {
    const { cycle, sessions } = duplicateCycle(
      bloc0,
      source,
      { name: 'Bloc 1', startDate: '2026-11-09', max: { ...bloc0.max, D: 215 }, mode: 'AS_IS' },
      templates,
      counter(),
    );
    expect(cycle).toMatchObject({ name: 'Bloc 1', startDate: '2026-11-09', weeksCount: 7, max: { S: 170, B: 115, D: 215 } });
    expect(cycle.id).not.toBe(bloc0.id);
    expect(cycle.weeklyPlan).toEqual(bloc0.weeklyPlan);
    expect(sessions).toHaveLength(28);
    expect(sessions.every((s) => s.cycleId === cycle.id)).toBe(true);
    expect(sessions.flatMap((s) => s.exercises.flatMap((e) => e.sets)).every((x) => x.status === 'PLANNED')).toBe(true);
    // Décalage de 7 semaines, jour et semaine conservés.
    const moved = sessions.find((s) => s.exercises[0]?.name === 'Deadlift modifié');
    expect(moved?.date).toBe('2026-11-17');
    expect(moved?.cycleWeek).toBe(2);
    const dl3 = sessions.find((s) => s.date === '2026-11-24'); // Deadlift S3 : 70 % de 215
    expect(displayKg(dl3!.exercises[0]!.sets[0]!, cycle.max, 1)).toBe(151);
  });

  it('peut régénérer depuis les modèles', () => {
    const { sessions } = duplicateCycle(
      bloc0,
      source,
      { name: 'Bloc 1', startDate: '2026-11-09', max: bloc0.max, mode: 'TEMPLATE' },
      templates,
      counter(),
    );
    expect(sessions).toHaveLength(28);
    expect(sessions.some((s) => s.exercises[0]?.name === 'Deadlift modifié')).toBe(false);
  });
});

describe('déplacer et conflits', () => {
  const sessions = generateCycleSessions(bloc0, templates, counter());

  it('déplacer une séance met à jour sa semaine de cycle, pas sa prescription', () => {
    const moved = moveSession(sessions[0]!, '2026-09-30', [bloc0]);
    expect(moved).toMatchObject({ date: '2026-09-30', cycleId: 'c0', cycleWeek: 2 });
    expect(moved.exercises).toBe(sessions[0]!.exercises);
    expect(moveSession(sessions[0]!, '2027-01-05', [bloc0])).toMatchObject({ cycleId: null, cycleWeek: null });
  });

  it('détecte et résout les conflits jour par jour', () => {
    const existing = sessions.filter((s) => s.cycleWeek === 1);
    const incoming = duplicateWeek(
      { sessions, sourceMonday: '2026-09-28', targetMonday: '2026-09-21', mode: 'AS_IS', templateWeek: 1, templates, cycles: [bloc0] },
      counter(),
    ).concat([{ ...sessions[0]!, id: 'free', date: '2026-09-23' }]);
    expect(conflictDates(incoming, existing)).toEqual(['2026-09-22', '2026-09-24', '2026-09-26', '2026-09-27']);

    const { save, remove } = resolveConflicts(incoming, existing, {
      '2026-09-22': 'REPLACE',
      '2026-09-24': 'SKIP',
      '2026-09-26': 'ADD',
      // 2026-09-27 non précisé : ajout à côté
    });
    expect(save.map((s) => s.date)).toEqual(['2026-09-22', '2026-09-26', '2026-09-27', '2026-09-23']);
    expect(remove.map((s) => s.date)).toEqual(['2026-09-22']);
  });
});
