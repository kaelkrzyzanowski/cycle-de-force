import { describe, expect, it } from 'vitest';
import { goalProgress, lastDays, mergeSteps, stepsToKm } from './steps';

describe('podomètre', () => {
  it('fusion : garde le plus grand compte de chaque jour, ne renvoie que les jours à écrire', () => {
    const stored = [
      { date: '2026-11-02', steps: 8000 },
      { date: '2026-11-03', steps: 4000 },
    ];
    expect(mergeSteps(stored, { '2026-11-03': 6500, '2026-11-02': 7000, '2026-11-04': 1200 })).toEqual([
      { date: '2026-11-03', steps: 6500 },
      { date: '2026-11-04', steps: 1200 },
    ]);
    expect(mergeSteps(stored, { '2026-11-05': 0 })).toEqual([]);
  });

  it('derniers jours avec les jours vides à 0', () => {
    expect(lastDays([{ date: '2026-11-03', steps: 500 }], '2026-11-04', 3)).toEqual([
      { date: '2026-11-02', steps: 0 },
      { date: '2026-11-03', steps: 500 },
      { date: '2026-11-04', steps: 0 },
    ]);
  });

  it('objectif et distance estimée', () => {
    expect(goalProgress(5000, 10_000)).toBe(0.5);
    expect(goalProgress(12_000, 10_000)).toBe(1);
    expect(stepsToKm(10_000)).toBe(7.5);
  });
});
