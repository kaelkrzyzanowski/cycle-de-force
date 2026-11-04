import { addDays, mondayOf } from './dates';
import { displayKg, displayReps, isRealized } from './load';
import { setsTotals } from './totals';
import type { Activity, Cycle, IsoDate, Maxes, Rounding, Session } from './types';

const NO_MAX: Maxes = { S: 0, B: 0, D: 0 };
const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** e1RM d'Epley, seulement pour 1 à 10 reps ; une série de 1 vaut sa charge. */
export function e1rm(reps: number, kg: number): number | null {
  if (reps < 1 || reps > 10 || kg <= 0) return null;
  return round1(reps === 1 ? kg : kg * (1 + reps / 30));
}

export type MaxOf = (session: Session) => Maxes;

export function maxOfCycles(cycles: readonly Cycle[]): MaxOf {
  const byId = new Map(cycles.map((c) => [c.id, c.max]));
  return (s) => (s.cycleId ? byId.get(s.cycleId) : undefined) ?? NO_MAX;
}

function sessionTonnage(s: Session, maxOf: MaxOf, rounding: Rounding): number {
  return setsTotals(
    s.exercises.flatMap((e) => e.sets),
    maxOf(s),
    rounding,
  ).tonnage;
}

/** Période affichée dans les stats ; « all » part des plus anciennes données. */
export type Period = '4w' | '3m' | '12m' | 'all';
export const PERIODS: readonly Period[] = ['4w', '3m', '12m', 'all'];

/** Regroupement des graphiques : par semaine (lundi) jusqu'à 3 mois, par mois au-delà. */
export type Bucket = 'week' | 'month';
export const bucketOf = (period: Period): Bucket => (period === '4w' || period === '3m' ? 'week' : 'month');

const firstOfMonth = (date: IsoDate): IsoDate => `${date.slice(0, 7)}-01`;

function addMonths(first: IsoDate, n: number): IsoDate {
  const index = Number(first.slice(0, 4)) * 12 + Number(first.slice(5, 7)) - 1 + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
}

const bucketKey = (date: IsoDate, bucket: Bucket): IsoDate => (bucket === 'week' ? mondayOf(date) : firstOfMonth(date));

/**
 * Premier jour de la période (début de semaine ou de mois) : 4 semaines ou 13 semaines en cours comprises,
 * 12 mois en cours compris, ou depuis `earliest` pour « tout ».
 */
export function periodStart(period: Period, today: IsoDate, earliest: IsoDate | null): IsoDate {
  switch (period) {
    case '4w':
      return addDays(mondayOf(today), -3 * 7);
    case '3m':
      return addDays(mondayOf(today), -12 * 7);
    case '12m':
      return addMonths(firstOfMonth(today), -11);
    case 'all':
      return firstOfMonth(earliest !== null && earliest < today ? earliest : today);
  }
}

/** Début de chaque semaine ou mois entre deux dates incluses. */
export function bucketsBetween(from: IsoDate, to: IsoDate, bucket: Bucket): IsoDate[] {
  const out: IsoDate[] = [];
  for (let key = bucketKey(from, bucket); key <= to; key = bucket === 'week' ? addDays(key, 7) : addMonths(key, 1)) out.push(key);
  return out;
}

const hasRealizedSet = (s: Session): boolean => s.exercises.some((e) => e.sets.some((x) => isRealized(x.status)));

/** Séances de la période avec au moins une série réalisée, triées par date. */
export function realizedSessions(sessions: readonly Session[], from: IsoDate, to: IsoDate): Session[] {
  return sessions.filter((s) => s.date >= from && s.date <= to && hasRealizedSet(s)).sort((a, b) => a.date.localeCompare(b.date));
}

/** Première et dernière dates avec une série réalisée ou une activité, ou null. */
export function dataRange(sessions: readonly Session[], activities: readonly Activity[]): { first: IsoDate; last: IsoDate } | null {
  const dates = [...sessions.filter(hasRealizedSet).map((s) => s.date), ...activities.map((a) => a.date)].sort();
  const first = dates[0];
  const last = dates.at(-1);
  return first && last ? { first, last } : null;
}

/** Tonnage de chaque semaine ou mois de la période, périodes vides comprises. */
export function tonnageByBucket(
  sessions: readonly Session[],
  maxOf: MaxOf,
  rounding: Rounding,
  from: IsoDate,
  to: IsoDate,
  bucket: Bucket,
): { start: IsoDate; tonnage: number }[] {
  const totals = new Map(bucketsBetween(from, to, bucket).map((k) => [k, 0]));
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue;
    const key = bucketKey(s.date, bucket);
    totals.set(key, round2((totals.get(key) ?? 0) + sessionTonnage(s, maxOf, rounding)));
  }
  return [...totals].map(([start, tonnage]) => ({ start, tonnage }));
}

/** Distance cardio de chaque semaine ou mois de la période, périodes vides comprises. */
export function distanceByBucket(activities: readonly Activity[], from: IsoDate, to: IsoDate, bucket: Bucket): { start: IsoDate; km: number }[] {
  const totals = new Map(bucketsBetween(from, to, bucket).map((k) => [k, 0]));
  for (const a of activities) {
    if (a.date < from || a.date > to) continue;
    const key = bucketKey(a.date, bucket);
    totals.set(key, round2((totals.get(key) ?? 0) + a.distanceKm));
  }
  return [...totals].map(([start, km]) => ({ start, km }));
}

export interface ExercisePoint {
  date: IsoDate;
  sessionId: string;
  /** Charge la plus lourde réalisée ce jour-là. */
  maxKg: number;
  /** Meilleur e1RM du jour (séries de 1 à 10 reps), ou null. */
  e1rm: number | null;
}

/** Charge max réalisée et e1RM, séance par séance, pour un exercice. */
export function exerciseProgress(sessions: readonly Session[], exerciseId: string, maxOf: MaxOf, rounding: Rounding): ExercisePoint[] {
  const points: ExercisePoint[] = [];
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    let maxKg = 0;
    let best: number | null = null;
    for (const e of s.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const set of e.sets) {
        if (!isRealized(set.status)) continue;
        const kg = displayKg(set, maxOf(s), rounding);
        if (kg === null || kg <= 0) continue;
        maxKg = Math.max(maxKg, kg);
        const est = e1rm(displayReps(set), kg);
        if (est !== null && (best === null || est > best)) best = est;
      }
    }
    if (maxKg > 0) points.push({ date: s.date, sessionId: s.id, maxKg, e1rm: best });
  }
  return points;
}

/** Exercices ayant au moins une série réalisée avec une charge, triés par nom. */
export function exercisesWithData(sessions: readonly Session[]): { exerciseId: string; name: string }[] {
  const found = new Map<string, string>();
  for (const s of sessions)
    for (const e of s.exercises)
      if (e.sets.some((x) => isRealized(x.status) && (x.actualKg ?? 0) > 0)) found.set(e.exerciseId, e.name);
  return [...found].map(([exerciseId, name]) => ({ exerciseId, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
