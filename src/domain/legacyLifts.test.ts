import { describe, expect, it } from 'vitest';
import { migrateLegacyLifts } from './legacyLifts';

/** Données au format d'avant la v2 : RM limités à S/B/D. */
const legacy = {
  templates: [
    {
      id: 'tpl-bench',
      name: 'Bench',
      weeks: { 1: [{ exerciseId: 'dc-spoto', name: 'DC Spoto', sets: [{ reps: 5, load: { kind: 'PERCENT', lift: 'B', pct: 0.7 } }] }] },
    },
  ],
  exercises: [{ id: 'squat', name: 'Squat perso', aliases: [], defaultLift: 'S' }],
  cycles: [{ id: 'c0', name: 'Bloc 0', max: { S: 170, B: 115, D: 210 } }],
  sessions: [
    {
      id: 's1',
      exercises: [
        {
          id: 'e1',
          exerciseId: 'deadlift-sumo',
          name: 'Deadlift Sumo',
          sets: [
            { index: 0, plannedReps: 4, status: 'VALIDATED', actualKg: 147, load: { kind: 'PERCENT', lift: 'D', pct: 0.7 } },
            { index: 1, plannedReps: 8, status: 'PLANNED', load: { kind: 'FIXED', kg: 80 } },
          ],
        },
      ],
    },
  ],
  maxChanges: [{ id: 'm1', cycleId: 'c0', lift: 'D', from: 210, to: 215, at: '2026-09-24T10:00:00Z' }],
};

describe('migration vers le RM par exercice', () => {
  const out = migrateLegacyLifts(legacy) as unknown as typeof legacy & {
    exercises: { id: string; name: string; hasMax?: boolean; short?: string; defaultMax?: string }[];
  };

  it('les % et les max référencent un exercice', () => {
    expect(out.cycles[0]!.max).toEqual({ squat: 170, 'developpe-couche': 115, 'souleve-de-terre': 210 });
    expect(out.templates[0]!.weeks[1]![0]!.sets[0]!.load).toEqual({ kind: 'PERCENT', of: 'developpe-couche', pct: 0.7 });
    const sets = out.sessions[0]!.exercises[0]!.sets;
    expect(sets[0]).toEqual({ index: 0, plannedReps: 4, status: 'VALIDATED', actualKg: 147, load: { kind: 'PERCENT', of: 'souleve-de-terre', pct: 0.7 } });
    expect(sets[1]!.load).toEqual({ kind: 'FIXED', kg: 80 });
    expect(out.maxChanges[0]).toEqual({ id: 'm1', cycleId: 'c0', exerciseId: 'souleve-de-terre', from: 210, to: 215, at: '2026-09-24T10:00:00Z' });
  });

  it('crée les exercices avec RM et complète le catalogue sans écraser l’existant', () => {
    const byId = new Map(out.exercises.map((e) => [e.id, e]));
    expect(byId.get('squat')).toEqual({ id: 'squat', name: 'Squat perso', aliases: [], defaultMax: 'squat', hasMax: true, short: 'S' });
    expect(byId.get('developpe-couche')).toMatchObject({ name: 'Développé couché', hasMax: true, short: 'B' });
    expect(byId.get('souleve-de-terre')).toMatchObject({ hasMax: true, short: 'D' });
    expect(byId.get('dc-spoto')).toEqual({ id: 'dc-spoto', name: 'DC Spoto', aliases: [], defaultMax: 'developpe-couche' });
    expect(byId.get('deadlift-sumo')).toEqual({ id: 'deadlift-sumo', name: 'Deadlift Sumo', aliases: [], defaultMax: 'souleve-de-terre' });
  });

  it('est idempotente', () => {
    expect(migrateLegacyLifts(out)).toEqual(out);
  });
});
