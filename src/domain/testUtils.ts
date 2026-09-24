import type { LoadRule, Maxes, Session, SessionSet, SetStatus } from './types';

export const MAX: Maxes = { S: 170, B: 115, D: 210 };

export const pct = (lift: 'S' | 'B' | 'D', p: number): LoadRule => ({ kind: 'PERCENT', lift, pct: p });
export const fixed = (kg: number): LoadRule => ({ kind: 'FIXED', kg });

export function set(index: number, plannedReps: number, load: LoadRule, status: SetStatus = 'PLANNED'): SessionSet {
  return { index, plannedReps, load, status };
}

export function session(date: string, sets: SessionSet[], id = 's1'): Session {
  return {
    id,
    cycleId: 'c1',
    templateId: null,
    cycleWeek: 1,
    date,
    name: 'Test',
    exercises: [{ id: 'e1', exerciseId: 'x', name: 'Deadlift Sumo', position: 0, sets }],
  };
}
