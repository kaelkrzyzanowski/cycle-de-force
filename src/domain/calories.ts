import { isRealized } from './load';
import { sessionTotals } from './totals';
import type { Activity, ActivityType, Maxes, Profile, Rounding, Session } from './types';

/** Profil utilisable pour le calcul : âge, poids et taille renseignés. */
export function isCompleteProfile(profile: Profile | undefined): profile is Profile {
  return !!profile && profile.ageYears > 0 && profile.weightKg > 0 && profile.heightCm > 0;
}

/** Sexe non précisé : milieu entre les constantes homme (+5) et femme (−161). */
const SEX_OFFSET: Record<Profile['sex'], number> = { M: 5, F: -161, NA: -78 };

/** Métabolisme de base en kcal par jour (Mifflin-St Jeor). */
export function basalKcalPerDay(p: Profile): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.ageYears + SEX_OFFSET[p.sex];
}

/** Dépense relative (MET) selon la vitesse en km/h, d'après le Compendium of Physical Activities. */
const MET_BY_SPEED: Record<ActivityType, readonly (readonly [number, number])[]> = {
  RUNNING: [[6.4, 6], [8, 8.3], [9.7, 9.8], [10.8, 10.5], [12, 11.8], [12.9, 12.3], [14.5, 13.3], [16, 14.5], [17.7, 16], [19.3, 19]],
  WALKING: [[3.2, 2.8], [4, 3], [4.8, 3.5], [5.6, 4.3], [6.4, 5], [7.2, 7], [8, 8.3]],
  CYCLING: [[10, 4], [17.7, 6.8], [20.9, 8], [24, 10], [28, 12], [32, 15.8]],
  SWIMMING: [[1.5, 5.8], [3, 9.8]],
  OTHER: [[0, 5]],
};

/** MET interpolé entre les vitesses du tableau, borné à ses extrémités. */
export function activityMet(type: ActivityType, speedKmh: number): number {
  const table = MET_BY_SPEED[type];
  const first = table[0]!;
  if (speedKmh <= first[0]) return first[1];
  for (let i = 1; i < table.length; i++) {
    const [s0, m0] = table[i - 1]!;
    const [s1, m1] = table[i]!;
    if (speedKmh <= s1) return m0 + ((speedKmh - s0) / (s1 - s0)) * (m1 - m0);
  }
  return table.at(-1)![1];
}

/**
 * Calories dépensées (repos compris), arrondies : MET × métabolisme de base ramené à la durée.
 * Estimation, null si le profil est incomplet.
 */
export function activityKcal(profile: Profile | undefined, activity: Pick<Activity, 'type' | 'distanceKm' | 'durationSec'>): number | null {
  if (!isCompleteProfile(profile) || !(activity.durationSec > 0)) return null;
  const hours = activity.durationSec / 3600;
  const met = activityMet(activity.type, activity.distanceKm / hours);
  return Math.round((met * basalKcalPerDay(profile) * hours) / 24);
}

/** Durée estimée d'une série en musculation, récupération comprise (minutes). */
export const STRENGTH_MIN_PER_SET = 3;
/** MET du Compendium : musculation modérée (3,5) à soutenue, type force athlétique (6). */
const STRENGTH_MET = { light: 3.5, heavy: 6 } as const;
/** Tonnage par minute à partir duquel la séance est comptée comme soutenue. */
const HEAVY_KG_PER_MIN = 200;

/**
 * Calories d'une séance de musculation : durée estimée d'après le nombre de séries réalisées,
 * intensité (MET) d'après le tonnage par minute, appliquées au métabolisme de base. Estimation.
 */
export function strengthKcal(profile: Profile | undefined, realizedSets: number, tonnageKg: number): number | null {
  if (!isCompleteProfile(profile) || realizedSets <= 0) return null;
  const minutes = realizedSets * STRENGTH_MIN_PER_SET;
  const intensity = Math.min(1, Math.max(0, tonnageKg / minutes / HEAVY_KG_PER_MIN));
  const met = STRENGTH_MET.light + (STRENGTH_MET.heavy - STRENGTH_MET.light) * intensity;
  return Math.round((met * basalKcalPerDay(profile) * minutes) / 60 / 24);
}

/** Séance terminée : au moins une série, et plus aucune série prévue. */
export const isFinished = (session: Pick<Session, 'exercises'>): boolean => {
  const sets = session.exercises.flatMap((e) => e.sets);
  return sets.length > 0 && sets.every((s) => s.status !== 'PLANNED');
};

/** Calories d'une séance une fois terminée, sinon null. */
export function sessionKcal(profile: Profile | undefined, session: Session, max: Maxes, rounding: Rounding): number | null {
  if (!isFinished(session)) return null;
  const realized = session.exercises.reduce((n, e) => n + e.sets.filter((s) => isRealized(s.status)).length, 0);
  return strengthKcal(profile, realized, sessionTotals(session, max, rounding).tonnage);
}
