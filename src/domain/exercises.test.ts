import { describe, expect, it } from 'vitest';
import { renameExercise } from './exercises';
import { effectiveMax, exerciseMaxes, withUpdatedMaxes } from './max';
import { maxOfCycles } from './stats';
import { session, set, fixed } from './testUtils';
import type { Exercise, SessionTemplate } from './types';

describe('RM des exercices', () => {
  const exercises: Exercise[] = [
    { id: 'squat', name: 'Squat', aliases: [], hasMax: true, max: 150 },
    { id: 'presse', name: 'Presse', aliases: [], max: 0 },
    { id: 'curl', name: 'Curl', aliases: [] },
  ];

  it('le RM du cycle prime, le RM de l’exercice complète', () => {
    const fallback = exerciseMaxes(exercises);
    expect(fallback).toEqual({ squat: 150 });
    expect(effectiveMax({ squat: 160, dc: 0 }, fallback)).toEqual({ squat: 160 });
    expect(effectiveMax({ dc: 100 }, fallback)).toEqual({ squat: 150, dc: 100 });
    expect(effectiveMax(undefined, fallback)).toEqual({ squat: 150 });
  });

  it('séances hors cycle : les % se calculent sur les RM des exercices', () => {
    const free = { ...session('2026-09-22', [set(0, 5, fixed(100))]), cycleId: null };
    expect(maxOfCycles([], { squat: 150 })(free)).toEqual({ squat: 150 });
  });

  it('un RM saisi dans un cycle devient le RM actuel de l’exercice', () => {
    expect(withUpdatedMaxes(exercises, { squat: 150, presse: 200, curl: 0 })).toEqual([
      { id: 'presse', name: 'Presse', aliases: [], max: 200, hasMax: true },
    ]);
  });
});

describe('renommer un exercice', () => {
  const template: SessionTemplate = {
    id: 't1',
    name: 'Jambes',
    color: '#000',
    native: false,
    weeksCount: 2,
    weeks: { 1: [{ exerciseId: 'presse', name: 'Presse', sets: [] }], 2: [{ exerciseId: 'curl', name: 'Curl', sets: [] }] },
  };
  const s = session('2026-09-22', []);
  s.exercises = [{ id: 'e1', exerciseId: 'presse', name: 'Presse', position: 0, sets: [] }];

  it('reporte le nom dans les modèles et les séances concernés, et seulement eux', () => {
    const out = renameExercise('presse', 'Presse à cuisses', [template], [s, { ...s, id: 's2', exercises: [] }]);
    expect(out.templates).toHaveLength(1);
    expect(out.templates[0]?.weeks[1]?.[0]?.name).toBe('Presse à cuisses');
    expect(out.templates[0]?.weeks[2]?.[0]?.name).toBe('Curl');
    expect(out.sessions.map((x) => x.id)).toEqual(['s1']);
    expect(out.sessions[0]?.exercises[0]?.name).toBe('Presse à cuisses');
    expect(renameExercise('presse', 'Presse', [template], [s])).toEqual({ templates: [], sessions: [] });
  });
});
