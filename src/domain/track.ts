import type { ActivityType, TrackPoint } from './types';

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance en mètres entre deux points (formule de haversine). */
export function haversineM(a: Pick<TrackPoint, 'lat' | 'lon'>, b: Pick<TrackPoint, 'lat' | 'lon'>): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Vitesse au-delà de laquelle un saut GPS est jugé aberrant (m/s), selon le sport. */
const MAX_SPEED_MS: Record<ActivityType, number> = {
  RUNNING: 12,
  WALKING: 6,
  CYCLING: 30,
  SWIMMING: 4,
  OTHER: 30,
};

/** Précision GPS (m) au-delà de laquelle un point est ignoré. */
export const MAX_ACCURACY_M = 35;

/**
 * Faut-il garder ce nouveau point ? Non s'il est trop imprécis, ou si le saut depuis le dernier point gardé
 * du même segment suppose une vitesse impossible pour ce sport.
 */
export function acceptPoint(previous: TrackPoint | undefined, next: TrackPoint, accuracyM: number, type: ActivityType): boolean {
  if (!(accuracyM <= MAX_ACCURACY_M)) return false;
  if (!previous || previous.seg !== next.seg) return true;
  const dt = (next.t - previous.t) / 1000;
  if (dt <= 0) return false;
  return haversineM(previous, next) / dt <= MAX_SPEED_MS[type];
}

/** Distance parcourue en km, segment par segment (les pauses ne comptent pas). */
export function trackDistanceKm(points: readonly TrackPoint[]): number {
  let meters = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.seg === b.seg) meters += haversineM(a, b);
  }
  return Math.round(meters) / 1000;
}

/** Réduit le tracé pour l'enregistrement : un point au plus tous les `minM` mètres, extrémités de segment gardées. */
export function simplifyTrack(points: readonly TrackPoint[], minM = 5): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const last = out.at(-1);
    const segEnd = i === points.length - 1 || points[i + 1]!.seg !== p.seg;
    if (!last || last.seg !== p.seg || segEnd || haversineM(last, p) >= minM) {
      out.push({ lat: round6(p.lat), lon: round6(p.lon), t: p.t, seg: p.seg });
    }
  }
  return out;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Chronomètre d'enregistrement : temps actif, pauses exclues. */
export interface TrackClock {
  /** Temps actif cumulé des segments terminés (ms). */
  accumulatedMs: number;
  /** Début du segment en cours, ou null en pause. */
  runningSince: number | null;
}

export const newClock = (now: number): TrackClock => ({ accumulatedMs: 0, runningSince: now });
export const elapsedMs = (c: TrackClock, now: number): number =>
  c.accumulatedMs + (c.runningSince === null ? 0 : Math.max(0, now - c.runningSince));
export const pauseClock = (c: TrackClock, now: number): TrackClock =>
  c.runningSince === null ? c : { accumulatedMs: elapsedMs(c, now), runningSince: null };
export const resumeClock = (c: TrackClock, now: number): TrackClock => (c.runningSince === null ? { ...c, runningSince: now } : c);
