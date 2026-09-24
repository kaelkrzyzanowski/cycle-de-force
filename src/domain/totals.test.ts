import { describe, expect, it } from 'vitest';
import { recordSet, validateSet } from './sets';
import { sessionTotals, setsTotals } from './totals';
import { fixed, MAX, pct, session, set } from './testUtils';

describe('setsTotals', () => {
  it('ignore les séries prévues et non réalisées', () => {
    const sets = [
      validateSet(set(0, 4, pct('D', 0.7)), MAX, 1), // 4 × 147 = 588
      set(1, 4, pct('D', 0.7)),
      recordSet(set(2, 4, pct('D', 0.7)), 'NOT_DONE', {}, MAX, 1),
    ];
    expect(setsTotals(sets, MAX, 1)).toEqual({ tonnage: 588, reps: 4, kgPerRep: 147 });
  });

  it('compte toutes les séries, y compris la 5e (bug de l’Excel)', () => {
    const sets = [0, 1, 2, 3, 4].map((i) => validateSet(set(i, 10, fixed(50)), MAX, 1));
    expect(setsTotals(sets, MAX, 1).tonnage).toBe(2500);
    expect(setsTotals(sets, MAX, 1).reps).toBe(50);
  });

  it('utilise le réalisé pour un échec et un cluster', () => {
    const sets = [
      validateSet(set(0, 4, pct('D', 0.8)), MAX, 1), // 4 × 168 = 672
      recordSet(set(1, 4, pct('D', 0.8)), 'FAILED', { reps: 3, kg: 168 }, MAX, 1), // 504
      recordSet(set(2, 6, fixed(100)), 'CLUSTER', { reps: 6, kg: 95 }, MAX, 1), // 570
    ];
    const t = setsTotals(sets, MAX, 1);
    expect(t.tonnage).toBe(1746);
    expect(t.reps).toBe(13);
    expect(t.kgPerRep).toBe(134.3);
  });

  it('renvoie des zéros sans série réalisée', () => {
    expect(setsTotals([set(0, 4, fixed(100))], MAX, 1)).toEqual({ tonnage: 0, reps: 0, kgPerRep: 0 });
  });

  it('additionne tous les exercices d’une séance', () => {
    const s = session('2026-09-22', [validateSet(set(0, 2, fixed(100)), MAX, 1)]);
    s.exercises.push({ ...s.exercises[0]!, id: 'e2', sets: [validateSet(set(0, 3, fixed(50)), MAX, 1)] });
    expect(sessionTotals(s, MAX, 1)).toEqual({ tonnage: 350, reps: 5, kgPerRep: 70 });
  });
});
