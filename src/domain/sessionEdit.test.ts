import { describe, expect, it } from 'vitest';
import { exampleCycle, nativeTemplates } from '../seed';
import { generateCycleSessions } from './cycles';
import { applyEdit, propagateEdits, pushEdit } from './sessionEdit';
import type { SessionEdit } from './sessionEdit';
import { canQuickValidate, mapSet, recordSet, validateExercise, validateSet } from './sets';
import { fixed, MAX, pct, session, set } from './testUtils';
import type { Session } from './types';

let n = 0;
const newId = () => `x${++n}`;
const templates = new Map(nativeTemplates().map((t) => [t.id, t]));
const bloc0 = exampleCycle('c0', '2026-09-21');
const all = generateCycleSessions(bloc0, templates, newId);
const deadlifts = all.filter((s) => s.name === 'Deadlift');
const HACK = 'hack-squat';

describe('saisie des séries', () => {
  it('tout valider ignore les séries à saisir et déjà faites', () => {
    const s = session('2026-09-22', [
      set(0, 5, fixed(100)),
      recordSet(set(1, 5, fixed(100)), 'FAILED', { reps: 3 }, MAX, 1),
      set(2, 1, { kind: 'NONE' }),
    ]);
    const ex = validateExercise(s.exercises[0]!, MAX, 1);
    expect(ex.sets.map((x) => x.status)).toEqual(['VALIDATED', 'FAILED', 'PLANNED']);
    expect(ex.sets[1]?.actualReps).toBe(3);
    expect(canQuickValidate(set(0, 0, fixed(10)))).toBe(false);
  });

  it('mapSet ne touche que la série visée', () => {
    const s = session('2026-09-22', [set(0, 4, pct('D', 0.7)), set(1, 4, pct('D', 0.7))]);
    const next = mapSet(s, 'e1', 1, (x) => validateSet(x, MAX, 1));
    expect(next.exercises[0]?.sets.map((x) => x.status)).toEqual(['PLANNED', 'VALIDATED']);
    expect(s.exercises[0]?.sets[1]?.status).toBe('PLANNED');
  });
});

describe('opérations d’édition', () => {
  const dl1 = deadlifts[0]!;

  it('modifie une série prévue, jamais une série réalisée', () => {
    const edit: SessionEdit = { kind: 'updateSet', exerciseId: HACK, index: 0, reps: 10, load: fixed(90) };
    const next = applyEdit(dl1, edit, newId)!;
    const hack = next.exercises.find((e) => e.exerciseId === HACK)!;
    expect(hack.sets[0]).toMatchObject({ plannedReps: 10, load: fixed(90) });

    const done = mapSet(dl1, dl1.exercises.find((e) => e.exerciseId === HACK)!.id, 0, (x) => validateSet(x, MAX, 1));
    expect(applyEdit(done, edit, newId)).toBeNull();
  });

  it('ajoute, déplace, renomme et supprime des exercices', () => {
    let s: Session = dl1;
    s = applyEdit(s, { kind: 'addExercise', exerciseId: 'dips', name: 'Dips', sets: [{ reps: 8, load: fixed(0) }] }, newId)!;
    expect(s.exercises.at(-1)).toMatchObject({ name: 'Dips', position: s.exercises.length - 1 });
    s = applyEdit(s, { kind: 'moveExercise', exerciseId: 'dips', delta: -1 }, newId)!;
    expect(s.exercises.at(-2)?.name).toBe('Dips');
    expect(s.exercises.map((e) => e.position)).toEqual(s.exercises.map((_, i) => i));
    expect(applyEdit(s, { kind: 'moveExercise', exerciseId: s.exercises[0]!.exerciseId, delta: -1 }, newId)).toBeNull();
    s = applyEdit(s, { kind: 'renameExercise', exerciseId: 'dips', newExerciseId: 'dips-lestes', name: 'Dips lestés' }, newId)!;
    expect(s.exercises.some((e) => e.exerciseId === 'dips-lestes')).toBe(true);
    s = applyEdit(s, { kind: 'removeExercise', exerciseId: 'dips-lestes' }, newId)!;
    expect(s.exercises).toHaveLength(dl1.exercises.length);
  });

  it('ajoute et supprime des séries en réindexant', () => {
    let s = applyEdit(dl1, { kind: 'addSet', exerciseId: HACK, set: { reps: 8, load: fixed(80) } }, newId)!;
    expect(s.exercises.find((e) => e.exerciseId === HACK)?.sets).toHaveLength(4);
    s = applyEdit(s, { kind: 'removeSet', exerciseId: HACK, index: 0 }, newId)!;
    expect(s.exercises.find((e) => e.exerciseId === HACK)?.sets.map((x) => x.index)).toEqual([0, 1, 2]);
  });

  it('fusionne les modifications successives d’une même série', () => {
    const a: SessionEdit = { kind: 'updateSet', exerciseId: HACK, index: 0, reps: 9, load: fixed(80) };
    const b: SessionEdit = { kind: 'updateSet', exerciseId: HACK, index: 0, reps: 10, load: fixed(80) };
    expect(pushEdit(pushEdit([], a), b)).toEqual([b]);
  });
});

describe('propagation aux semaines suivantes', () => {
  const edits: SessionEdit[] = [
    { kind: 'updateSet', exerciseId: HACK, index: 0, reps: 10, load: fixed(90) },
    { kind: 'addExercise', exerciseId: 'dips', name: 'Dips', sets: [{ reps: 8, load: fixed(0) }] },
  ];

  it('applique aux séances futures du même modèle dans le même cycle', () => {
    const source = deadlifts[2]!; // S3
    const updated = propagateEdits(source, all, edits, newId);
    expect(updated.map((s) => s.cycleWeek)).toEqual([4, 5, 6, 7]);
    for (const s of updated) {
      expect(s.exercises.find((e) => e.exerciseId === HACK)?.sets[0]).toMatchObject({ plannedReps: 10, load: fixed(90) });
      expect(s.exercises.filter((e) => e.exerciseId === 'dips')).toHaveLength(1);
    }
  });

  it('ne touche pas les séries déjà réalisées ni les autres modèles', () => {
    const source = deadlifts[2]!;
    const s4 = deadlifts[3]!;
    const hackRow = s4.exercises.find((e) => e.exerciseId === HACK)!.id;
    const s4done = mapSet(s4, hackRow, 0, (x) => validateSet(x, MAX, 1));
    const sessions = all.map((s) => (s.id === s4.id ? s4done : s));
    const updated = propagateEdits(source, sessions, edits, newId);
    const s4after = updated.find((s) => s.id === s4.id)!;
    expect(s4after.exercises.find((e) => e.exerciseId === HACK)?.sets[0]).toMatchObject({ status: 'VALIDATED', plannedReps: 8 });
    expect(updated.every((s) => s.name === 'Deadlift')).toBe(true);
  });

  it('rien à propager hors cycle', () => {
    expect(propagateEdits({ ...deadlifts[0]!, cycleId: null }, all, edits, newId)).toEqual([]);
  });
});
