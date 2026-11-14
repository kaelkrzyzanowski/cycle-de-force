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

/**
 * Vitesse instantanée en km/h : distance des `windowMs` dernières millisecondes du segment en cours.
 * null sans point récent (signal perdu, pause) ou sur trop peu de temps pour être fiable.
 */
export function instantSpeedKmh(points: readonly TrackPoint[], now: number, windowMs = 10_000, staleMs = 8_000): number | null {
  const last = points.at(-1);
  if (!last || now - last.t > staleMs) return null;
  let meters = 0;
  let first = last;
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1]!;
    if (a.seg !== last.seg || last.t - a.t > windowMs) break;
    meters += haversineM(a, points[i]!);
    first = a;
  }
  const seconds = (last.t - first.t) / 1000;
  return seconds >= 2 ? Math.round((meters / seconds) * 3.6 * 10) / 10 : null;
}

/** Altitudes lissées sur `window` points (moyenne glissante), pour gommer le bruit vertical du GPS. */
function smooth(values: readonly number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const part = values.slice(Math.max(0, i - half), i + half + 1);
    return part.reduce((a, b) => a + b, 0) / part.length;
  });
}

/**
 * Dénivelé positif en mètres, segment par segment : altitudes lissées, puis seules les montées d'au moins
 * `thresholdM` comptent (hystérésis contre le bruit vertical). null si le GPS n'a fourni aucune altitude.
 */
export function elevationGainM(points: readonly TrackPoint[], thresholdM = 3): number | null {
  const withAlt = points.filter((p): p is TrackPoint & { alt: number } => p.alt !== undefined);
  if (withAlt.length === 0) return null;
  let gain = 0;
  let start = 0;
  while (start < withAlt.length) {
    let end = start;
    while (end < withAlt.length && withAlt[end]!.seg === withAlt[start]!.seg) end++;
    const alts = smooth(withAlt.slice(start, end).map((p) => p.alt), 5);
    // Hors montée, ref suit le point bas ; une montée commence à +seuil et compte alors depuis ce point bas,
    // puis chaque mètre gagné compte jusqu'à une redescente d'au moins le seuil.
    let ref = alts[0]!;
    let climbing = false;
    for (const a of alts) {
      if (climbing) {
        if (a > ref) {
          gain += a - ref;
          ref = a;
        } else if (ref - a >= thresholdM) {
          climbing = false;
          ref = a;
        }
      } else if (a < ref) {
        ref = a;
      } else if (a - ref >= thresholdM) {
        gain += a - ref;
        ref = a;
        climbing = true;
      }
    }
    start = end;
  }
  return Math.round(gain);
}

/** Réduit le tracé pour l'enregistrement : un point au plus tous les `minM` mètres, extrémités de segment gardées. */
export function simplifyTrack(points: readonly TrackPoint[], minM = 5): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const last = out.at(-1);
    const segEnd = i === points.length - 1 || points[i + 1]!.seg !== p.seg;
    if (!last || last.seg !== p.seg || segEnd || haversineM(last, p) >= minM) {
      out.push({ lat: round6(p.lat), lon: round6(p.lon), t: p.t, seg: p.seg, ...(p.alt !== undefined ? { alt: Math.round(p.alt * 10) / 10 } : {}) });
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
