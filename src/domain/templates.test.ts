import { describe, expect, it } from 'vitest';
import { exampleCycle, nativeTemplates, TEMPLATE_IDS } from '../seed';
import { generateCycleSessions } from './cycles';
import { plannedKg } from './load';
import { applyEdit } from './sessionEdit';
import { validateSet } from './sets';
import {
  applyProgression,
  copyWeek,
  duplicateTemplate,
  emptyTemplate,
  progressionValues,
  refreshFromTemplate,
  sessionAsWeek,
  setWeeksCount,
  untouchedFutureSessions,
  weekAsSession,
} from './templates';
import { MAX } from './testUtils';
import type { SessionTemplate } from './types';

let n = 0;
const newId = () => `t${++n}`;
const bench = () => nativeTemplates().find((t) => t.id === TEMPLATE_IDS.bench)!;

/** « Bench volume » : 4 semaines, Développé couché 4 × 8. */
function benchVolume(): SessionTemplate {
  let t = emptyTemplate('Bench volume', 1, '#3d6fd1', newId);
  const draft = applyEdit(
    weekAsSession(t, 1),
    {
      kind: 'addExercise',
      exerciseId: 'developpe-couche',
      name: 'Développé couché',
      sets: [0, 1, 2, 3].map(() => ({ reps: 8, load: { kind: 'NONE' as const } })),
    },
    newId,
  )!;
  t = { ...t, weeks: { 1: sessionAsWeek(draft) } };
  return setWeeksCount(t, 4);
}

describe('modèles', () => {
  it('crée un modèle perso vide et en change le nombre de semaines', () => {
    const t = emptyTemplate('Test', 3, '#000', newId);
    expect(t).toMatchObject({ native: false, weeksCount: 3, weeks: { 1: [], 2: [], 3: [] } });
    expect(t.id.startsWith('tpl-')).toBe(true);

    const b = setWeeksCount(bench(), 9);
    expect(b.weeksCount).toBe(9);
    expect(b.weeks[9]).toEqual(bench().weeks[7]); // copies de la dernière semaine
    const short = setWeeksCount(bench(), 4);
    expect(Object.keys(short.weeks)).toEqual(['1', '2', '3', '4']);
  });

  it('dupliquer un natif donne un modèle perso indépendant', () => {
    const original = bench();
    const copy = duplicateTemplate(original, 'Bench perso', newId);
    expect(copy).toMatchObject({ name: 'Bench perso', native: false, weeksCount: 7 });
    expect(copy.id).not.toBe(original.id);
    copy.weeks[1]![0]!.sets[0]!.reps = 99;
    expect(original.weeks[1]![0]!.sets[0]!.reps).toBe(4);
  });

  it('copier la semaine k vers d’autres semaines', () => {
    const b = copyWeek(bench(), 1, [3, 5, 1, 12]);
    expect(b.weeks[3]).toEqual(bench().weeks[1]);
    expect(b.weeks[5]).toEqual(bench().weeks[1]);
    expect(b.weeks[2]).toEqual(bench().weeks[2]);
    expect(b.weeks[12]).toBeUndefined();
    b.weeks[3]![0]!.name = 'modifié';
    expect(b.weeks[5]![0]!.name).not.toBe('modifié');
  });

  it('semaine ↔ séance : aller-retour sans perte', () => {
    const b = bench();
    for (let w = 1; w <= 7; w++) expect(sessionAsWeek(weekAsSession(b, w))).toEqual(b.weeks[w]);
  });
});

describe('progression', () => {
  it('calcule les pourcentages semaine par semaine, plafonnés', () => {
    expect(progressionValues({ from: 0.65, to: 0.8, step: 0.05, weeks: [4, 1, 2, 3] })).toEqual([
      { week: 1, pct: 0.65 },
      { week: 2, pct: 0.7 },
      { week: 3, pct: 0.75 },
      { week: 4, pct: 0.8 },
    ]);
    expect(progressionValues({ from: 0.65, to: 0.85, step: 0.05, weeks: [1, 2, 3, 4, 5, 6] }).map((v) => v.pct)).toEqual([
      0.65, 0.7, 0.75, 0.8, 0.85, 0.85,
    ]);
    expect(progressionValues({ from: 0.8, to: 0.7, step: 0.05, weeks: [1, 2, 3] }).map((v) => v.pct)).toEqual([0.8, 0.75, 0.7]);
  });

  it('Bench volume : 65 → 80 % du Bench sur 4 semaines', () => {
    const { template, skipped } = applyProgression(benchVolume(), {
      exerciseId: 'developpe-couche',
      lift: 'B',
      from: 0.65,
      to: 0.8,
      step: 0.05,
      weeks: [1, 2, 3, 4],
    });
    expect(skipped).toEqual([]);
    const kg = (w: number) => template.weeks[w]![0]!.sets.map((s) => plannedKg(s.load, MAX, 1));
    expect(kg(1)).toEqual([75, 75, 75, 75]); // 74,75
    expect(kg(2)).toEqual([81, 81, 81, 81]); // 80,5
    expect(kg(3)).toEqual([86, 86, 86, 86]); // 86,25
    expect(kg(4)).toEqual([92, 92, 92, 92]);
  });

  it('une semaine sans l’exercice (deload) ne fait pas avancer la progression', () => {
    // Développé couché du modèle Bench : absent en S3.
    const { template, skipped } = applyProgression(bench(), {
      exerciseId: 'developpe-couche',
      lift: 'B',
      from: 0.7,
      to: 0.9,
      step: 0.05,
      weeks: [2, 3, 4, 5],
    });
    expect(skipped).toEqual([3]);
    const pct = (w: number) => {
      const load = template.weeks[w]?.find((e) => e.exerciseId === 'developpe-couche')?.sets[0]?.load;
      return load?.kind === 'PERCENT' ? load.pct : null;
    };
    expect([pct(2), pct(4), pct(5)]).toEqual([0.7, 0.75, 0.8]);
    expect(template.weeks[3]).toEqual(bench().weeks[3]);
  });
});

describe('mise à jour des séances futures', () => {
  const templates = new Map(nativeTemplates().map((t) => [t.id, t]));
  const cycle = exampleCycle('c0', '2026-09-21');
  const sessions = generateCycleSessions(cycle, templates, newId).filter((s) => s.templateId === TEMPLATE_IDS.bench);

  it('ne retient que les séances à venir et non commencées', () => {
    const started = { ...sessions[2]!, exercises: sessions[2]!.exercises.map((e, i) => (i ? e : { ...e, sets: [validateSet(e.sets[0]!, MAX, 1)] })) };
    const noted = { ...sessions[3]!, note: 'genou' };
    const list = [sessions[0]!, sessions[1]!, started, noted, ...sessions.slice(4)];
    const targets = untouchedFutureSessions(bench(), list, '2026-10-04'); // Bench S2 : samedi 3 oct., passé
    expect(targets.map((s) => s.cycleWeek)).toEqual([5, 6, 7]);
  });

  it('reprend la prescription de la semaine de cycle en gardant date et identifiant', () => {
    const edited = copyWeek(bench(), 1, [5]);
    const [s5] = refreshFromTemplate(edited, [sessions[4]!], newId);
    expect(s5).toMatchObject({ id: sessions[4]!.id, date: sessions[4]!.date, cycleId: 'c0', cycleWeek: 5 });
    expect(s5!.exercises.map((e) => e.name)).toEqual(bench().weeks[1]!.map((e) => e.name));
  });

  it('ignore les séances dont la prescription ne change pas', () => {
    const edited = copyWeek(bench(), 1, [5]);
    expect(refreshFromTemplate(edited, sessions, newId).map((s) => s.cycleWeek)).toEqual([5]);
    expect(refreshFromTemplate(bench(), sessions, newId)).toEqual([]);
  });
});
