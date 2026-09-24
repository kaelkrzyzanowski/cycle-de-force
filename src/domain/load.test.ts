import { describe, expect, it } from 'vitest';
import { differsFromPlan, displayKg, displayReps, plannedKg, roundTo } from './load';
import { recordSet, resetSet, validateSet } from './sets';
import { fixed, MAX, pct, set } from './testUtils';

describe('roundTo', () => {
  it('arrondit au kg par défaut, sans erreur flottante', () => {
    expect(roundTo(210 * 0.7, 1)).toBe(147);
    expect(roundTo(115 * 0.65, 1)).toBe(75); // 74,75
  });
  it('gère tous les pas', () => {
    expect(roundTo(74.75, 2.5)).toBe(75);
    expect(roundTo(73.6, 1.25)).toBe(73.75);
    expect(roundTo(74.2, 0.5)).toBe(74);
    expect(roundTo(74.25, 0.5)).toBe(74.5);
    expect(roundTo(74.756, 0)).toBe(74.76);
  });
});

describe('plannedKg', () => {
  it('calcule un % du max du mouvement choisi', () => {
    expect(plannedKg(pct('D', 0.7), MAX, 1)).toBe(147);
    expect(plannedKg(pct('B', 0.7), MAX, 1)).toBe(81); // DC Spoto à 70 % du Bench (80,5)
    expect(plannedKg(pct('S', 0.6), MAX, 2.5)).toBe(102.5);
  });
  it('renvoie la charge fixe, le lest, ou null si à saisir', () => {
    expect(plannedKg(fixed(80), MAX, 1)).toBe(80);
    expect(plannedKg({ kind: 'BODYWEIGHT', extraKg: 7.5 }, MAX, 1)).toBe(7.5);
    expect(plannedKg({ kind: 'BODYWEIGHT' }, MAX, 1)).toBe(0);
    expect(plannedKg({ kind: 'NONE' }, MAX, 1)).toBeNull();
  });
});

describe('transitions de série', () => {
  it('valider fige reps et charge prévues', () => {
    const s = validateSet(set(0, 4, pct('D', 0.7)), MAX, 1);
    expect(s).toMatchObject({ status: 'VALIDATED', actualReps: 4, actualKg: 147 });
    // La charge reste figée même si le max change ensuite.
    expect(displayKg(s, { ...MAX, D: 220 }, 1)).toBe(147);
  });

  it('un échec remplace le prévu par le réalisé', () => {
    const s = recordSet(set(0, 4, pct('D', 0.8)), 'FAILED', { reps: 3, kg: 168 }, MAX, 1);
    expect(displayReps(s)).toBe(3);
    expect(displayKg(s, MAX, 1)).toBe(168);
    expect(differsFromPlan(s, MAX, 1)).toBe(true);
  });

  it('un cluster sans valeur saisie reprend le prévu', () => {
    const s = recordSet(set(0, 5, fixed(80)), 'CLUSTER', {}, MAX, 1);
    expect(s).toMatchObject({ status: 'CLUSTER', actualReps: 5, actualKg: 80 });
    expect(differsFromPlan(s, MAX, 1)).toBe(false);
  });

  it('non réalisé et retour à prévu effacent les valeurs réalisées', () => {
    const failed = recordSet(set(0, 4, fixed(100)), 'FAILED', { reps: 2 }, MAX, 1);
    const notDone = recordSet(failed, 'NOT_DONE', {}, MAX, 1);
    expect(notDone.actualReps).toBeUndefined();
    expect(notDone.actualKg).toBeUndefined();
    const reset = resetSet(validateSet(set(0, 4, fixed(100)), MAX, 1));
    expect(reset).toEqual(set(0, 4, fixed(100)));
  });

  it('une charge à saisir ne fige pas de charge', () => {
    const s = validateSet(set(0, 1, { kind: 'NONE' }), MAX, 1);
    expect(s.actualKg).toBeUndefined();
    expect(displayKg(s, MAX, 1)).toBeNull();
  });
});
