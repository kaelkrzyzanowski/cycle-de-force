import type { ActivityType } from './types';

export const ACTIVITY_TYPES: readonly ActivityType[] = ['RUNNING', 'CYCLING', 'WALKING', 'SWIMMING', 'OTHER'];

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  RUNNING: '#e0631f',
  CYCLING: '#2a7de1',
  WALKING: '#4caf50',
  SWIMMING: '#00acc1',
  OTHER: '#8d6e63',
};

/** Glyphe court affiché dans la pastille du calendrier, à défaut d'icône dédiée. */
export const ACTIVITY_GLYPH: Record<ActivityType, string> = {
  RUNNING: 'C',
  CYCLING: 'V',
  WALKING: 'M',
  SWIMMING: 'N',
  OTHER: '•',
};

/** Allure en minutes par km ; null si la distance est nulle ou invalide. */
export function paceMinPerKm(distanceKm: number, durationSec: number): number | null {
  if (!(distanceKm > 0) || !Number.isFinite(durationSec)) return null;
  return durationSec / 60 / distanceKm;
}

/** Vitesse moyenne en km/h ; null si la durée est nulle ou invalide. */
export function averageSpeedKmh(distanceKm: number, durationSec: number): number | null {
  if (!(durationSec > 0) || !Number.isFinite(distanceKm)) return null;
  return distanceKm / (durationSec / 3600);
}

/** Distance et durée saisissables (> 0, finies, durée entière en secondes). */
export function isValidActivity(distanceKm: number, durationSec: number): boolean {
  return Number.isFinite(distanceKm) && distanceKm > 0 && Number.isInteger(durationSec) && durationSec > 0;
}
