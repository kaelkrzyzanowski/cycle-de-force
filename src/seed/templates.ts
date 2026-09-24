import { slugify } from '../domain/ids';
import type { ExercisePrescription, SessionTemplate } from '../domain/types';
import { parseSets } from './notation';

/** Données issues de l'onglet « Bloc (0) » du cahier Excel (7 semaines). Repos supprimés. */

const WEEKS = 7;
const ALL = [1, 2, 3, 4, 5, 6, 7] as const;

type Row = { name: string; weeks: Partial<Record<number, string>> };

const every = (name: string, spec: string): Row => ({
  name,
  weeks: Object.fromEntries(ALL.map((w) => [w, spec])),
});

const on = (name: string, weeks: readonly number[], spec: string): Row => ({
  name,
  weeks: Object.fromEntries(weeks.map((w) => [w, spec])),
});

const byWeek = (name: string, weeks: Partial<Record<number, string>>): Row => ({ name, weeks });

function build(id: string, name: string, color: string, rows: Row[]): SessionTemplate {
  const weeks: Record<number, ExercisePrescription[]> = {};
  for (const w of ALL) {
    weeks[w] = rows.flatMap((row) => {
      const spec = row.weeks[w];
      if (spec === undefined) return [];
      return [{ exerciseId: slugify(row.name), name: row.name, sets: parseSets(spec) }];
    });
  }
  return { id, name, color, native: true, weeksCount: WEEKS, weeks };
}

export const TEMPLATE_IDS = {
  deadlift: 'tpl-deadlift',
  sbd: 'tpl-sbd',
  bench: 'tpl-bench',
  squat: 'tpl-squat',
  joker: 'tpl-joker',
} as const;

const deadlift = build(TEMPLATE_IDS.deadlift, 'Deadlift', '#b5452f', [
  on("Deadlift Sumo 2''+ iso", [1, 2, 3, 6, 7], '2x4@70%D'),
  byWeek('Deadlift Sumo + Inche mur', {
    1: '4x5@80%D',
    2: '4x4@85%D',
    3: '4@85%D, 3x3@90%D',
    4: '4@85%D, 1@90%D, 1@95%D, 8@65%D',
    6: '4x6@65%D',
    7: '4x6@75%D',
  }),
  on('Squat Sumo', [5], '4x12@40'),
  on('RDL', [5], '4x8@80'),
  every('Hack Squat', '3x8@80'),
  every('Lombaire', '3x10@50'),
  every('Rowing 3 points', '3x12@36'),
  every('Tirage dos Rameur', '3x12@65'),
  on('Poulie Dos', [5], '3x12@40'),
]);

const sbd = build(TEMPLATE_IDS.sbd, 'SBD', '#c9a227', [
  every('Squat 420', '3x4@60%S'),
  every('DC 420', '3x5@65%B'),
  every('Deadlift Sumo 420', '3x4@65%D'),
  every('Iso SBD', '2x1'),
  every('DM', '3x8@40'),
  every('Y fly', '3x12@6'),
  every('Pull dos poulie', '3x15@40'),
]);

const bench = build(TEMPLATE_IDS.bench, 'Bench', '#3d6fd1', [
  on('DC pause 2" + iso haltères', [1, 4, 5, 6, 7], '2x4@70%B'),
  byWeek('Développé couché', {
    1: '4@85%B, 3x3@90%B',
    2: '4@85%B, 1@90%B, 1@95%B, 8@73',
    4: '4x8@65%B',
    5: '4x6@75%B',
    6: '4x5@80%B',
    7: '4x4@85%B',
  }),
  on('Dips lestés', [3], '3x8@+20'),
  on('DM', [3], '4x8@40'),
  on('DC Haltères incliné', [1, 2, 4, 5, 6, 7], '4x12@26'),
  byWeek('Rowing barre', { 1: '3x10@80', 2: '3x10@85', 3: '3x10@85', 4: '3x10@85', 5: '3x10@85', 6: '3x10@85', 7: '3x10@85' }),
  byWeek('Reverse fly', { 1: '3x12@10', 2: '3x12@12', 3: '3x12@12', 4: '3x12@12', 5: '3x12@12', 6: '3x12@12', 7: '3x12@12' }),
  every('Triceps', '3x15@20'),
  every('Traction', '3x8@+7.5'),
  every('Biceps', '3x12@25'),
]);

const squat = build(TEMPLATE_IDS.squat, 'Squat', '#2a9d8f', [
  on('Hack Squat Inversé', [1], '3x8@70'),
  on('Squat Sumo seatbelt', [1], '3x10@100'),
  on('Squat pause 2" + iso', [2, 3, 4, 5, 6], '2x4@60%S'),
  byWeek('Squat', {
    2: '4x8@65%S',
    3: '4x6@75%S',
    4: '4x5@80%S',
    5: '4x4@85%S',
    6: '4@85%S, 3x3@90%S',
    7: '4@85%S, 1@90%S, 1@95%S, 8@65%S',
  }),
  on('DC Spoto 3"', [1, 3, 5, 7], '3x5@70%B'),
  on('DC Haltère', [2, 4, 6], '3x8@30'),
  on('Abductor moyen fessier', [1, 2, 3], '3x15@65'),
  on('Abductor moyen fessier', [4, 5, 6, 7], '3x15@60'),
  every('Fente bulgare', '2x8@18'),
  every('Leg extension', '2x10@22.5'),
  every('Good morning', '2x8@80'),
]);

const joker = build(TEMPLATE_IDS.joker, 'Joker', '#6b7280', [
  every('DC incliné haltères', '2x0'),
  every('Squat', '2x0'),
  every('Traction', '2x0'),
  every('Tirage dos', '2x0'),
  every('Soulevé de terre', '2x0'),
  every('Épaule poulie', '2x0'),
  every('Biceps/triceps', '2x0'),
]);

/** Les 5 modèles natifs, dans l'ordre d'affichage. */
export function nativeTemplates(): SessionTemplate[] {
  return structuredClone([deadlift, sbd, bench, squat, joker]);
}
