import { describe, expect, it } from 'vitest';
import { activityKcal, activityMet, basalKcalPerDay, isCompleteProfile } from './calories';
import type { Profile } from './types';

const man: Profile = { sex: 'M', ageYears: 35, weightKg: 80, heightCm: 180 };

describe('calories', () => {
  it('métabolisme de base de Mifflin-St Jeor selon le sexe', () => {
    expect(basalKcalPerDay(man)).toBe(1755);
    expect(basalKcalPerDay({ ...man, sex: 'F' })).toBe(1589);
    expect(basalKcalPerDay({ ...man, sex: 'NA' })).toBe(1672);
  });

  it('plus âgé ou plus léger : dépense plus faible ; plus lourd ou plus grand : plus forte', () => {
    const run = { type: 'RUNNING', distanceKm: 10, durationSec: 3600 } as const;
    const base = activityKcal(man, run)!;
    expect(activityKcal({ ...man, ageYears: 55 }, run)!).toBeLessThan(base);
    expect(activityKcal({ ...man, weightKg: 70 }, run)!).toBeLessThan(base);
    expect(activityKcal({ ...man, weightKg: 90 }, run)!).toBeGreaterThan(base);
    expect(activityKcal({ ...man, heightCm: 190 }, run)!).toBeGreaterThan(base);
  });

  it('MET interpolé selon la vitesse et borné', () => {
    expect(activityMet('RUNNING', 8)).toBe(8.3);
    expect(activityMet('RUNNING', 2)).toBe(6);
    expect(activityMet('RUNNING', 30)).toBe(19);
    expect(activityMet('WALKING', 4.4)).toBeCloseTo(3.25);
    expect(activityMet('OTHER', 12)).toBe(5);
  });

  it('course de 10 km en 1 h : de l’ordre de 700 kcal pour 80 kg', () => {
    const kcal = activityKcal(man, { type: 'RUNNING', distanceKm: 10, durationSec: 3600 })!;
    expect(kcal).toBeGreaterThan(680);
    expect(kcal).toBeLessThan(760);
  });

  it('pas de résultat sans profil complet ni durée', () => {
    const walk = { type: 'WALKING', distanceKm: 1, durationSec: 600 } as const;
    expect(activityKcal(undefined, walk)).toBeNull();
    expect(activityKcal({ ...man, weightKg: 0 }, walk)).toBeNull();
    expect(activityKcal(man, { ...walk, durationSec: 0 })).toBeNull();
    expect(isCompleteProfile(man)).toBe(true);
  });
});
