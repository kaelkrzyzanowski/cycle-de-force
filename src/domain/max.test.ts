import { describe, expect, it } from 'vitest';
import { displayKg } from './load';
import { applyMaxChange, previewMaxChange } from './max';
import { recordSet, validateSet } from './sets';
import { fixed, MAX, pct, session, set } from './testUtils';
import type { Cycle } from './types';

const cycle: Cycle = {
  id: 'c1',
  name: 'Bloc 0',
  startDate: '2026-09-21',
  weeksCount: 7,
  max: MAX,
  weeklyPlan: [],
};

describe('changement de max', () => {
  const done = validateSet(set(0, 4, pct('D', 0.7)), MAX, 1);
  const failed = recordSet(set(1, 4, pct('D', 0.7)), 'FAILED', { reps: 3 }, MAX, 1);
  const planned = set(2, 4, pct('D', 0.7));
  const bench = set(3, 5, pct('B', 0.7));
  const fixedSet = set(4, 8, fixed(80));
  const s = session('2026-09-22', [done, failed, planned, bench, fixedSet]);
  const newMax = { ...MAX, D: 215 };

  it("l'aperçu ne liste que les séries prévues du mouvement modifié", () => {
    expect(previewMaxChange([s], MAX, newMax, 1)).toEqual([
      { sessionId: 's1', date: '2026-09-22', exerciseName: 'Deadlift Sumo', setIndex: 2, lift: 'D', fromKg: 147, toKg: 151 },
    ]);
  });

  it('ne signale rien si l’arrondi absorbe le changement', () => {
    expect(previewMaxChange([s], MAX, { ...MAX, D: 210.5 }, 2.5)).toEqual([]);
  });

  it('les séries réalisées gardent leur charge, les prévues suivent le nouveau max', () => {
    const { cycle: updated } = applyMaxChange(cycle, newMax, '2026-09-24T10:00:00Z', () => 'id');
    expect(displayKg(done, updated.max, 1)).toBe(147);
    expect(displayKg(failed, updated.max, 1)).toBe(147);
    expect(displayKg(planned, updated.max, 1)).toBe(151);
    expect(displayKg(bench, updated.max, 1)).toBe(81);
  });

  it('journalise chaque mouvement modifié', () => {
    let n = 0;
    const { cycle: updated, log } = applyMaxChange(cycle, { S: 172.5, B: 115, D: 215 }, '2026-09-24T10:00:00Z', () => `m${++n}`);
    expect(updated.max).toEqual({ S: 172.5, B: 115, D: 215 });
    expect(cycle.max.D).toBe(210); // pas de mutation
    expect(log).toEqual([
      { id: 'm1', cycleId: 'c1', lift: 'S', from: 170, to: 172.5, at: '2026-09-24T10:00:00Z' },
      { id: 'm2', cycleId: 'c1', lift: 'D', from: 210, to: 215, at: '2026-09-24T10:00:00Z' },
    ]);
  });
});
