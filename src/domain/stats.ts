import { cycleWeekOf } from './cycles';
import { displayKg, displayReps, isRealized } from './load';
import { effectiveMax } from './max';
import { setsTotals } from './totals';
import type { Cycle, IsoDate, MaxChange, MaxId, Maxes, Rounding, Session, SetStatus } from './types';

const NO_MAX: Maxes = {};
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** e1RM d'Epley, seulement pour 1 à 10 reps ; une série de 1 vaut sa charge. */
export function e1rm(reps: number, kg: number): number | null {
  if (reps < 1 || reps > 10 || kg <= 0) return null;
  return round1(reps === 1 ? kg : kg * (1 + reps / 30));
}

export type MaxOf = (session: Session) => Maxes;

/** `fallback` : RM actuels des exercices, pour les séances hors cycle et les RM absents du cycle. */
export function maxOfCycles(cycles: readonly Cycle[], fallback: Maxes = NO_MAX): MaxOf {
  const byId = new Map(cycles.map((c) => [c.id, effectiveMax(c.max, fallback)]));
  return (s) => (s.cycleId ? byId.get(s.cycleId) : undefined) ?? fallback;
}

function sessionTonnage(s: Session, maxOf: MaxOf, rounding: Rounding): number {
  return setsTotals(
    s.exercises.flatMap((e) => e.sets),
    maxOf(s),
    rounding,
  ).tonnage;
}

export interface SessionTonnage {
  sessionId: string;
  date: IsoDate;
  name: string;
  templateId: string | null;
  cycleWeek: number | null;
  exercises: Session['exercises'];
  tonnage: number;
}

export function tonnageBySession(sessions: readonly Session[], maxOf: MaxOf, rounding: Rounding): SessionTonnage[] {
  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      sessionId: s.id,
      date: s.date,
      name: s.name,
      templateId: s.templateId,
      cycleWeek: s.cycleWeek,
      exercises: s.exercises,
      tonnage: sessionTonnage(s, maxOf, rounding),
    }));
}

/** Tonnage de chaque semaine du cycle (1..N), semaines vides comprises. */
export function tonnageByWeek(cycle: Cycle, sessions: readonly Session[], rounding: Rounding): { week: number; tonnage: number }[] {
  const totals = Array.from({ length: cycle.weeksCount }, (_, i) => ({ week: i + 1, tonnage: 0 }));
  for (const s of sessions) {
    if (s.cycleId !== cycle.id) continue;
    const week = s.cycleWeek ?? cycleWeekOf(cycle, s.date);
    const slot = week ? totals[week - 1] : undefined;
    if (slot) slot.tonnage = Math.round((slot.tonnage + sessionTonnage(s, () => cycle.max, rounding)) * 100) / 100;
  }
  return totals;
}

export function tonnageByCycle(
  cycles: readonly Cycle[],
  sessions: readonly Session[],
  rounding: Rounding,
): { cycleId: string; name: string; startDate: IsoDate; tonnage: number }[] {
  return [...cycles]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((c) => ({
      cycleId: c.id,
      name: c.name,
      startDate: c.startDate,
      tonnage: tonnageByWeek(c, sessions, rounding).reduce((t, w) => t + w.tonnage, 0),
    }));
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

export interface MaxPoint {
  date: IsoDate;
  value: number;
  cycleName: string;
}

/**
 * Évolution des max théoriques : pour chaque cycle, le max de départ à sa date de début
 * (reconstitué depuis le journal), puis chaque changement à sa date.
 */
export function maxHistory(cycles: readonly Cycle[], changes: readonly MaxChange[]): Map<MaxId, MaxPoint[]> {
  const out = new Map<MaxId, MaxPoint[]>();
  const push = (id: MaxId, p: MaxPoint) => {
    // Un RM à 0 = pas encore renseigné : pas de point.
    if (p.value > 0) out.set(id, [...(out.get(id) ?? []), p]);
  };
  for (const c of cycles) {
    const ids = new Set([...Object.keys(c.max), ...changes.filter((m) => m.cycleId === c.id).map((m) => m.exerciseId)]);
    for (const id of ids) {
      const log = changes.filter((m) => m.cycleId === c.id && m.exerciseId === id).sort((a, b) => a.at.localeCompare(b.at));
      push(id, { date: c.startDate, value: log[0]?.from ?? c.max[id] ?? 0, cycleName: c.name });
      for (const m of log) push(id, { date: m.at.slice(0, 10), value: m.to, cycleName: c.name });
    }
  }
  for (const points of out.values()) points.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export type StatusCounts = Record<SetStatus, number>;

export function statusBreakdown(sessions: readonly Session[]): StatusCounts {
  const counts: StatusCounts = { PLANNED: 0, VALIDATED: 0, FAILED: 0, NOT_DONE: 0, CLUSTER: 0 };
  for (const s of sessions) for (const e of s.exercises) for (const set of e.sets) counts[set.status]++;
  return counts;
}

/** Tonnage et nombre de séances par modèle (null = séances sans modèle), du plus gros au plus petit. */
export function volumeByTemplate(
  sessions: readonly Session[],
  maxOf: MaxOf,
  rounding: Rounding,
): { templateId: string | null; tonnage: number; sessions: number }[] {
  const acc = new Map<string | null, { tonnage: number; sessions: number }>();
  for (const s of sessions) {
    const t = sessionTonnage(s, maxOf, rounding);
    if (t === 0) continue;
    const entry = acc.get(s.templateId) ?? { tonnage: 0, sessions: 0 };
    entry.tonnage = Math.round((entry.tonnage + t) * 100) / 100;
    entry.sessions++;
    acc.set(s.templateId, entry);
  }
  return [...acc].map(([templateId, v]) => ({ templateId, ...v })).sort((a, b) => b.tonnage - a.tonnage);
}
