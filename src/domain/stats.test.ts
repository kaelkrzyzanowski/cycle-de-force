import { describe, expect, it } from 'vitest';
import { exampleCycle, nativeTemplates, TEMPLATE_IDS } from '../seed';
import { generateCycleSessions } from './cycles';
import { mapExercise, recordSet, validateExercise } from './sets';
import {
  averageSteps,
  stepsByBucket,
  bucketOf,
  bucketsBetween,
  distanceByBucket,
  dataRange,
  e1rm,
  exerciseProgress,
  exercisesWithData,
  maxOfCycles,
  periodStart,
  realizedSessions,
  tonnageByBucket,
} from './stats';
import type { Activity, Cycle, Session } from './types';

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

  it('par semaine calendaire, semaines vides comprises', () => {
    const weeks = tonnageByBucket(sessions, maxOf, 1, '2026-09-14', '2026-10-11', 'week');
    expect(weeks).toEqual([
      { start: '2026-09-14', tonnage: 0 },
      { start: '2026-09-21', tonnage: s1 },
      { start: '2026-09-28', tonnage: s2 },
      { start: '2026-10-05', tonnage: 0 },
    ]);
  });

  it('par mois', () => {
    expect(tonnageByBucket(sessions, maxOf, 1, '2026-09-01', '2026-10-31', 'month')).toEqual([
      { start: '2026-09-01', tonnage: s1 + s2 },
      { start: '2026-10-01', tonnage: 0 },
    ]);
  });

  it('séances réalisées de la période et première donnée', () => {
    expect(realizedSessions(sessions, '2026-09-01', '2026-12-31').map((s) => s.date)).toEqual(['2026-09-22', '2026-09-29']);
    expect(realizedSessions(sessions, '2026-09-23', '2026-12-31')).toHaveLength(1);
    expect(dataRange(sessions, [])).toEqual({ first: '2026-09-22', last: '2026-09-29' });
    expect(dataRange([], [])).toBeNull();
  });
});

describe('périodes', () => {
  const today = '2026-11-04'; // mercredi

  it('début de période aligné sur la semaine ou le mois', () => {
    expect(periodStart('4w', today, null)).toBe('2026-10-12');
    expect(periodStart('3m', today, null)).toBe('2026-08-10');
    expect(periodStart('12m', today, null)).toBe('2025-12-01');
    expect(periodStart('all', today, '2024-03-17')).toBe('2024-03-01');
    expect(periodStart('all', today, null)).toBe('2026-11-01');
  });

  it('découpage en semaines (4 ou 13) et en mois (12)', () => {
    expect(bucketsBetween(periodStart('4w', today, null), today, bucketOf('4w'))).toHaveLength(4);
    expect(bucketsBetween(periodStart('3m', today, null), today, bucketOf('3m'))).toHaveLength(13);
    const months = bucketsBetween(periodStart('12m', today, null), today, bucketOf('12m'));
    expect(months).toHaveLength(12);
    expect(months.at(0)).toBe('2025-12-01');
    expect(months.at(-1)).toBe('2026-11-01');
  });

  it('pas : moyenne par jour compté, par semaine et sur la période', () => {
    const days = [
      { date: '2026-10-27', steps: 8000 },
      { date: '2026-10-28', steps: 0 },
      { date: '2026-10-29', steps: 12_000 },
      { date: '2026-11-03', steps: 5000 },
    ];
    expect(stepsByBucket(days, '2026-10-26', today, 'week')).toEqual([
      { start: '2026-10-26', average: 10_000 },
      { start: '2026-11-02', average: 5000 },
    ]);
    expect(averageSteps(days, '2026-10-26', today)).toBe(8333);
    expect(averageSteps([], '2026-10-26', today)).toBeNull();
  });

  it('distance cardio par semaine', () => {
    const run = (date: string, distanceKm: number): Activity => ({ id: date, type: 'RUNNING', date, distanceKm, durationSec: 1800 });
    expect(distanceByBucket([run('2026-10-27', 5), run('2026-11-01', 7.5), run('2026-11-03', 4)], '2026-10-26', today, 'week')).toEqual([
      { start: '2026-10-26', km: 12.5 },
      { start: '2026-11-02', km: 4 },
    ]);
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
