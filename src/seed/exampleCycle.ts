import type { Cycle, IsoDate, Maxes, Weekday } from '../domain/types';
import { TEMPLATE_IDS } from './templates';

export const DEFAULT_MAX: Maxes = { S: 170, B: 115, D: 210 };

/** Planning par défaut : Mar Deadlift · Jeu SBD · Sam Bench · Dim Squat. */
export const DEFAULT_WEEKLY_PLAN: { weekday: Weekday; templateId: string }[] = [
  { weekday: 2, templateId: TEMPLATE_IDS.deadlift },
  { weekday: 4, templateId: TEMPLATE_IDS.sbd },
  { weekday: 6, templateId: TEMPLATE_IDS.bench },
  { weekday: 7, templateId: TEMPLATE_IDS.squat },
];

/** Cycle d'exemple « Bloc 0 », proposé au premier lancement. */
export function exampleCycle(id: string, startMonday: IsoDate): Cycle {
  return {
    id,
    name: 'Bloc 0',
    startDate: startMonday,
    weeksCount: 7,
    max: { ...DEFAULT_MAX },
    weeklyPlan: DEFAULT_WEEKLY_PLAN.map((e) => ({ ...e })),
  };
}
