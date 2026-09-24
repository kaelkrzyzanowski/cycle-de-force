import { describe, expect, it } from 'vitest';
import { exampleCycle, nativeTemplates, TEMPLATE_IDS } from '../seed';
import { generateCycleSessions } from './cycles';
import { mapExercise, recordSet, validateExercise } from './sets';
import {
  e1rm,
  exerciseProgress,
  exercisesWithData,
  maxHistory,
  maxOfCycles,
  statusBreakdown,
  tonnageByCycle,
  tonnageBySession,
  tonnageByWeek,
  volumeByTemplate,
} from './stats';
import type { Cycle, Session } from './types';

let n = 0;
const newId = () => `s${++n}`;
const templates = new Map(nativeTemplates().map((t) => [t.id, t]));
const HEAVY = 'deadlift-sumo-inche-mur';

describe('e1RM (Epley)', () => {
  it('kg × (1 + reps / 30), séries de 1 à 10 reps', () => {
    expect(e1rm(5, 168)).toBe(196);
    expect(e1rm(3, 150)).toBe(165);
    expect(e1rm(1, 200)).toBe(200);
    expect(e1rm(10, 100)).toBe(133.3);
    expect(e1rm(11, 100)).toBeNull();
    expect(e1rm(0, 100)).toBeNull();
    expect(e1rm(5, 0)).toBeNull();
  });
});

/** Bloc 0 avec les deux premières semaines de Deadlift faites (S2 : une série en échec). */
function workedCycle(): { cycle: Cycle; sessions: Session[] } {
  const cycle = exampleCycle('c0', '2026-09-21');
  const sessions = generateCycleSessions(cycle, templates, newId).map((s) => {
    if (s.templateId !== TEMPLATE_IDS.deadlift || (s.cycleWeek ?? 9) > 2) return s;
    let done = s;
    for (const e of s.exercises) done = mapExercise(done, e.id, (x) => validateExercise(x, cycle.max, 1));
    if (s.cycleWeek === 2) {
      const heavy = done.exercises.find((e) => e.exerciseId === HEAVY)!;
      done = mapExercise(done, heavy.id, (x) => ({
        ...x,
        sets: x.sets.map((set, i) => (i === 3 ? recordSet(set, 'FAILED', { reps: 2 }, cycle.max, 1) : set)),
      }));
    }
    return done;
  });
  return { cycle, sessions };
}

describe('tonnage', () => {
  const { cycle, sessions } = workedCycle();
  const maxOf = maxOfCycles([cycle]);

  // S1 Deadlift : 2×4×147 + 4×5×168 + 3×8×80 + 3×10×50 + 3×12×36 + 3×12×65
  const s1 = 1176 + 3360 + 1920 + 1500 + 1296 + 2340;
  // S2 : 2×4×147 + (3×4 + 2)×179 + mêmes accessoires
  const s2 = 1176 + 14 * 179 + 1920 + 1500 + 1296 + 2340;

  it('par séance', () => {
    const list = tonnageBySession(sessions, maxOf, 1);
    expect(list).toHaveLength(28);
    expect(list[0]).toMatchObject({ date: '2026-09-22', name: 'Deadlift', tonnage: s1 });
    expect(list.filter((x) => x.tonnage > 0).map((x) => x.tonnage)).toEqual([s1, s2]);
  });

  it('par semaine du cycle, semaines vides comprises', () => {
    const weeks = tonnageByWeek(cycle, sessions, 1);
    expect(weeks).toHaveLength(7);
    expect(weeks.map((w) => w.tonnage)).toEqual([s1, s2, 0, 0, 0, 0, 0]);
  });

  it('par cycle et par modèle', () => {
    const other: Cycle = { ...cycle, id: 'c1', name: 'Vide', startDate: '2026-11-09' };
    expect(tonnageByCycle([other, cycle], sessions, 1).map((c) => [c.name, c.tonnage])).toEqual([
      ['Bloc 0', s1 + s2],
      ['Vide', 0],
    ]);
    expect(volumeByTemplate(sessions, maxOf, 1)).toEqual([{ templateId: TEMPLATE_IDS.deadlift, tonnage: s1 + s2, sessions: 2 }]);
  });

  it('répartition des statuts', () => {
    const counts = statusBreakdown(sessions);
    expect(counts.FAILED).toBe(1);
    expect(counts.VALIDATED).toBe(2 * 18 - 1); // 18 séries par séance Deadlift (2 + 4 + 4 × 3)
    expect(counts.CLUSTER + counts.NOT_DONE).toBe(0);
  });
});

describe('progression d’un exercice', () => {
  const { cycle, sessions } = workedCycle();

  it('charge max et meilleur e1RM par séance', () => {
    const points = exerciseProgress(sessions, HEAVY, maxOfCycles([cycle]), 1);
    expect(points).toEqual([
      { date: '2026-09-22', sessionId: expect.any(String), maxKg: 168, e1rm: 196 }, // 5 × 168
      { date: '2026-09-29', sessionId: expect.any(String), maxKg: 179, e1rm: 202.9 }, // 4 × 179
    ]);
  });

  it('liste les exercices qui ont des données', () => {
    const names = exercisesWithData(sessions).map((e) => e.name);
    expect(names).toContain('Deadlift Sumo + Inche mur');
    expect(names).not.toContain('Squat 420');
  });
});

describe('évolution des max théoriques', () => {
  it('max de départ de chaque cycle, puis chaque changement', () => {
    const c0 = { ...exampleCycle('c0', '2026-09-21'), max: { S: 170, B: 115, D: 215 } };
    const c1 = { ...exampleCycle('c1', '2026-11-09'), name: 'Bloc 1', max: { S: 175, B: 117.5, D: 220 } };
    const history = maxHistory(
      [c1, c0],
      [{ id: 'm1', cycleId: 'c0', lift: 'D', from: 210, to: 215, at: '2026-10-01T09:00:00Z' }],
    );
    expect(history.D).toEqual([
      { date: '2026-09-21', value: 210, cycleName: 'Bloc 0' },
      { date: '2026-10-01', value: 215, cycleName: 'Bloc 0' },
      { date: '2026-11-09', value: 220, cycleName: 'Bloc 1' },
    ]);
    expect(history.S.map((p) => p.value)).toEqual([170, 175]);
  });
});
