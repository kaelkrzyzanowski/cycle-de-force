import type { LoadRule, Maxes, RealizedStatus, Rounding, SessionSet, SetStatus } from './types';

/** Arrondit au multiple de `step` le plus proche (0 = pas d'arrondi, 2 décimales). */
export function roundTo(kg: number, step: Rounding): number {
  if (step === 0) return Math.round(kg * 100) / 100;
  // L'epsilon absorbe les erreurs flottantes (210 × 0,7 = 146,99999…).
  const rounded = Math.round(kg / step + 1e-9) * step;
  return Math.round(rounded * 100) / 100;
}

/** Charge prévue d'une règle ; null si la charge est à saisir. */
export function plannedKg(rule: LoadRule, max: Maxes, rounding: Rounding): number | null {
  switch (rule.kind) {
    case 'FIXED':
      return rule.kg;
    case 'PERCENT':
      return roundTo(max[rule.lift] * rule.pct, rounding);
    case 'BODYWEIGHT':
      // Tonnage : seul le lest est compté (poids du corps non suivi).
      return rule.extraKg ?? 0;
    case 'NONE':
      return null;
  }
}

export function isRealized(status: SetStatus): status is RealizedStatus {
  return status === 'VALIDATED' || status === 'FAILED' || status === 'CLUSTER';
}

/** Charge affichée : la charge figée si la série est réalisée, sinon la charge prévue. */
export function displayKg(set: SessionSet, max: Maxes, rounding: Rounding): number | null {
  if (isRealized(set.status) && set.actualKg !== undefined) return set.actualKg;
  return plannedKg(set.load, max, rounding);
}

/** Reps affichées : les reps réalisées si la série est réalisée, sinon les reps prévues. */
export function displayReps(set: SessionSet): number {
  if (isRealized(set.status) && set.actualReps !== undefined) return set.actualReps;
  return set.plannedReps;
}

/** Vrai si le réalisé diffère du prévu (on affiche alors le prévu barré). */
export function differsFromPlan(set: SessionSet, max: Maxes, rounding: Rounding): boolean {
  if (!isRealized(set.status)) return false;
  const kg = plannedKg(set.load, max, rounding);
  return displayReps(set) !== set.plannedReps || (kg !== null && displayKg(set, max, rounding) !== kg);
}
