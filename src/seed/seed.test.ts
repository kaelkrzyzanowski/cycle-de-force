import { describe, expect, it } from 'vitest';
import { plannedKg } from '../domain/load';
import { MAX } from '../domain/testUtils';
import { parseSets } from './notation';
import { seedData, TEMPLATE_IDS } from '.';

describe('parseSets', () => {
  it('lit la notation du cahier', () => {
    expect(parseSets('2x4@70%D')).toEqual([
      { reps: 4, load: { kind: 'PERCENT', lift: 'D', pct: 0.7 } },
      { reps: 4, load: { kind: 'PERCENT', lift: 'D', pct: 0.7 } },
    ]);
    expect(parseSets('4@85%D, 1@95%D, 8@73').map((s) => s.reps)).toEqual([4, 1, 8]);
    expect(parseSets('8@73')[0]?.load).toEqual({ kind: 'FIXED', kg: 73 });
    expect(parseSets('3x8@+7.5')[0]?.load).toEqual({ kind: 'BODYWEIGHT', extraKg: 7.5 });
    expect(parseSets('2x10@22,5')[0]?.load).toEqual({ kind: 'FIXED', kg: 22.5 });
    expect(parseSets('2x1')[0]?.load).toEqual({ kind: 'NONE' });
    expect(parseSets('3x3@72.5%S')[0]?.load).toEqual({ kind: 'PERCENT', lift: 'S', pct: 0.725 });
  });
  it('refuse une notation illisible', () => {
    expect(() => parseSets('trois séries')).toThrow();
    expect(() => parseSets('3x4@70%X')).toThrow();
  });
});

describe('modèles natifs', () => {
  const { templates, exercises } = seedData();
  const byId = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) throw new Error(id);
    return t;
  };
  const names = (id: string, week: number) => (byId(id).weeks[week] ?? []).map((e) => e.name);

  it('fournit 5 modèles natifs de 7 semaines', () => {
    expect(templates.map((t) => t.name)).toEqual(['Deadlift', 'SBD', 'Bench', 'Squat', 'Joker']);
    for (const t of templates) {
      expect(t.native).toBe(true);
      expect(Object.keys(t.weeks)).toHaveLength(7);
    }
  });

  it('Deadlift S1 commence par 2 × 4 à 147 kg (70 % D)', () => {
    const first = byId(TEMPLATE_IDS.deadlift).weeks[1]?.[0];
    expect(first?.name).toBe("Deadlift Sumo 2''+ iso");
    expect(first?.sets).toHaveLength(2);
    expect(first?.sets.map((s) => [s.reps, plannedKg(s.load, MAX, 1)])).toEqual([
      [4, 147],
      [4, 147],
    ]);
  });

  it('Deadlift S5 remplace les lourds par Squat Sumo, RDL et ajoute Poulie Dos', () => {
    expect(names(TEMPLATE_IDS.deadlift, 5)).toEqual([
      'Squat Sumo',
      'RDL',
      'Hack Squat',
      'Lombaire',
      'Rowing 3 points',
      'Tirage dos Rameur',
      'Poulie Dos',
    ]);
    expect(byId(TEMPLATE_IDS.deadlift).weeks[4]?.[0]?.sets.map((s) => s.reps)).toEqual([4, 1, 1, 8]);
  });

  it('Bench : S3 sans DC Haltères incliné, rowing et reverse fly progressent après S1', () => {
    expect(names(TEMPLATE_IDS.bench, 3)).not.toContain('DC Haltères incliné');
    expect(names(TEMPLATE_IDS.bench, 3)).toContain('Dips lestés');
    const load = (w: number, name: string) =>
      byId(TEMPLATE_IDS.bench).weeks[w]?.find((e) => e.name === name)?.sets[0]?.load;
    expect(load(1, 'Rowing barre')).toEqual({ kind: 'FIXED', kg: 80 });
    expect(load(2, 'Rowing barre')).toEqual({ kind: 'FIXED', kg: 85 });
    expect(load(1, 'Reverse fly')).toEqual({ kind: 'FIXED', kg: 10 });
    expect(load(7, 'Reverse fly')).toEqual({ kind: 'FIXED', kg: 12 });
    expect(load(2, 'Développé couché')).toEqual({ kind: 'PERCENT', lift: 'B', pct: 0.85 });
  });

  it('Squat : DC Spoto en % du Bench les semaines impaires, abducteurs à 60 kg dès S4', () => {
    const t = byId(TEMPLATE_IDS.squat);
    expect(names(TEMPLATE_IDS.squat, 1)).toContain('DC Spoto 3"');
    expect(names(TEMPLATE_IDS.squat, 2)).toContain('DC Haltère');
    expect(t.weeks[3]?.find((e) => e.name === 'DC Spoto 3"')?.sets[0]?.load).toEqual({
      kind: 'PERCENT',
      lift: 'B',
      pct: 0.7,
    });
    expect(t.weeks[4]?.find((e) => e.name === 'Abductor moyen fessier')?.sets[0]?.load).toEqual({ kind: 'FIXED', kg: 60 });
  });

  it('SBD identique les 7 semaines, Joker sans charges', () => {
    const sbd = byId(TEMPLATE_IDS.sbd);
    for (let w = 2; w <= 7; w++) expect(sbd.weeks[w]).toEqual(sbd.weeks[1]);
    const joker = byId(TEMPLATE_IDS.joker).weeks[1] ?? [];
    expect(joker).toHaveLength(7);
    for (const e of joker) expect(e.sets).toEqual([
      { reps: 0, load: { kind: 'NONE' } },
      { reps: 0, load: { kind: 'NONE' } },
    ]);
  });

  it('chaque exercice des modèles existe dans le catalogue', () => {
    const ids = new Set(exercises.map((e) => e.id));
    for (const t of templates) for (const week of Object.values(t.weeks)) for (const e of week) expect(ids).toContain(e.exerciseId);
    expect(exercises.find((e) => e.id === 'dc-spoto-3')?.defaultLift).toBe('B');
  });
});
