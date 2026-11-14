import { describe, expect, it } from 'vitest';
import { activityKcal, activityMet, basalKcalPerDay, isCompleteProfile, isFinished, sessionKcal, strengthKcal } from './calories';
import { fixed, session, set } from './testUtils';
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

describe('calories de musculation', () => {
  it('durée selon les séries, intensité selon le tonnage par minute', () => {
    // 18 séries = 54 min ; 11 592 kg / 54 min > 200 kg/min : MET 6. 6 × 1 755 / 24 × 0,9 h.
    expect(strengthKcal(man, 18, 11_592)).toBe(395);
    // Même durée, tonnage faible : MET proche de 3,5.
    const light = strengthKcal(man, 18, 1000)!;
    expect(light).toBeGreaterThan(230);
    expect(light).toBeLessThan(260);
    expect(strengthKcal(man, 0, 0)).toBeNull();
    expect(strengthKcal(undefined, 18, 11_592)).toBeNull();
  });

  it('seulement une fois la séance terminée', () => {
    const done = session('2026-11-14', [set(0, 5, fixed(100), 'VALIDATED'), set(1, 5, fixed(100), 'VALIDATED')]);
    const ongoing = session('2026-11-14', [set(0, 5, fixed(100), 'VALIDATED'), set(1, 5, fixed(100))]);
    expect(isFinished(done)).toBe(true);
    expect(isFinished(ongoing)).toBe(false);
    expect(sessionKcal(man, ongoing, { S: 0, B: 0, D: 0 }, 1)).toBeNull();
    expect(sessionKcal(man, done, { S: 0, B: 0, D: 0 }, 1)).toBeGreaterThan(0);
  });
});
