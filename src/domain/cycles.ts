import { addDays, daysBetween } from './dates';
import type { Cycle, ExercisePrescription, IsoDate, Maxes, Session, SessionTemplate } from './types';

type NewId = () => string;
export type TemplatesById = ReadonlyMap<string, SessionTemplate>;

export function cycleEndDate(cycle: Pick<Cycle, 'startDate' | 'weeksCount'>): IsoDate {
  return addDays(cycle.startDate, cycle.weeksCount * 7 - 1);
}

/** Semaine du cycle (1..N) contenant la date, ou null hors du cycle. */
export function cycleWeekOf(cycle: Pick<Cycle, 'startDate' | 'weeksCount'>, date: IsoDate): number | null {
  const days = daysBetween(cycle.startDate, date);
  if (days < 0) return null;
  const week = Math.floor(days / 7) + 1;
  return week <= cycle.weeksCount ? week : null;
}

/** Cycle contenant la date ; en cas de chevauchement, le plus récent. */
export function findCycleForDate(cycles: readonly Cycle[], date: IsoDate): Cycle | undefined {
  return [...cycles]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .find((c) => cycleWeekOf(c, date) !== null);
}

export interface Placement {
  date: IsoDate;
  cycleId: string | null;
  cycleWeek: number | null;
}

export function placementFor(date: IsoDate, cycles: readonly Cycle[]): Placement {
  const cycle = findCycleForDate(cycles, date);
  return { date, cycleId: cycle?.id ?? null, cycleWeek: cycle ? cycleWeekOf(cycle, date) : null };
}

/** Prescription d'une semaine ; au-delà de la dernière semaine du modèle, on garde la dernière. */
export function templateWeek(template: SessionTemplate, week: number): ExercisePrescription[] {
  for (let w = Math.min(week, template.weeksCount); w >= 1; w--) {
    const prescription = template.weeks[w];
    if (prescription) return prescription;
  }
  return [];
}

/** Crée une séance en copiant la prescription : la modifier ne touche pas le modèle. */
export function sessionFromTemplate(template: SessionTemplate, week: number, placement: Placement, newId: NewId): Session {
  return {
    id: newId(),
    ...placement,
    templateId: template.id,
    name: template.name,
    exercises: templateWeek(template, week).map((p, position) => ({
      id: newId(),
      exerciseId: p.exerciseId,
      name: p.name,
      position,
      sets: p.sets.map((s, index) => ({ index, plannedReps: s.reps, load: structuredClone(s.load), status: 'PLANNED' })),
      ...(p.note ? { note: p.note } : {}),
    })),
  };
}

export function emptySession(name: string, placement: Placement, newId: NewId): Session {
  return { id: newId(), ...placement, templateId: null, name, exercises: [] };
}

/** Copie « telle quelle » : même contenu, nouveaux identifiants, tout repart en PLANNED, sans RIR ni notes. */
export function copySessionAsPlanned(session: Session, placement: Placement, newId: NewId): Session {
  return {
    id: newId(),
    ...placement,
    templateId: session.templateId,
    name: session.name,
    exercises: session.exercises.map((e) => ({
      id: newId(),
      exerciseId: e.exerciseId,
      name: e.name,
      position: e.position,
      sets: e.sets.map((s) => ({
        index: s.index,
        plannedReps: s.plannedReps,
        load: structuredClone(s.load),
        status: 'PLANNED',
      })),
    })),
  };
}

export function hasRealizedSets(session: Session): boolean {
  return session.exercises.some((e) => e.sets.some((s) => s.status !== 'PLANNED'));
}

export function generateCycleSessions(cycle: Cycle, templates: TemplatesById, newId: NewId): Session[] {
  const plan = [...cycle.weeklyPlan].sort((a, b) => a.weekday - b.weekday);
  const sessions: Session[] = [];
  for (let week = 1; week <= cycle.weeksCount; week++) {
    for (const entry of plan) {
      const template = templates.get(entry.templateId);
      if (!template) continue;
      const date = addDays(cycle.startDate, (week - 1) * 7 + entry.weekday - 1);
      sessions.push(sessionFromTemplate(template, week, { date, cycleId: cycle.id, cycleWeek: week }, newId));
    }
  }
  return sessions;
}

export type CopyMode = 'TEMPLATE' | 'AS_IS';

export interface WeekDuplication {
  /** Séances de la semaine source (les autres sont ignorées). */
  sessions: readonly Session[];
  sourceMonday: IsoDate;
  targetMonday: IsoDate;
  mode: CopyMode;
  /** Semaine k du modèle à reprendre en mode TEMPLATE. */
  templateWeek: number;
  templates: TemplatesById;
  cycles: readonly Cycle[];
}

/** Copie une semaine en conservant le jour de la semaine de chaque séance. */
export function duplicateWeek(args: WeekDuplication, newId: NewId): Session[] {
  const offset = daysBetween(args.sourceMonday, args.targetMonday);
  const sourceEnd = addDays(args.sourceMonday, 6);
  return args.sessions
    .filter((s) => s.date >= args.sourceMonday && s.date <= sourceEnd)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => {
      const placement = placementFor(addDays(s.date, offset), args.cycles);
      const template = args.mode === 'TEMPLATE' && s.templateId ? args.templates.get(s.templateId) : undefined;
      return template
        ? sessionFromTemplate(template, args.templateWeek, placement, newId)
        : copySessionAsPlanned(s, placement, newId);
    });
}

export interface CycleDuplication {
  name: string;
  startDate: IsoDate;
  max: Maxes;
  mode: CopyMode;
}

/** Nouveau cycle indépendant : même planning, nouvelles dates et nouveaux max. */
export function duplicateCycle(
  source: Cycle,
  sourceSessions: readonly Session[],
  opts: CycleDuplication,
  templates: TemplatesById,
  newId: NewId,
): { cycle: Cycle; sessions: Session[] } {
  const cycle: Cycle = {
    ...structuredClone(source),
    id: newId(),
    name: opts.name,
    startDate: opts.startDate,
    max: { ...opts.max },
  };
  if (opts.mode === 'TEMPLATE') return { cycle, sessions: generateCycleSessions(cycle, templates, newId) };

  const offset = daysBetween(source.startDate, opts.startDate);
  const sessions = sourceSessions
    .filter((s) => s.cycleId === source.id)
    .map((s) => {
      const date = addDays(s.date, offset);
      return copySessionAsPlanned(s, { date, cycleId: cycle.id, cycleWeek: cycleWeekOf(cycle, date) }, newId);
    });
  return { cycle, sessions };
}

/** Déplace une séance : elle garde sa prescription, son rattachement au cycle suit la nouvelle date. */
export function moveSession(session: Session, date: IsoDate, cycles: readonly Cycle[]): Session {
  return { ...session, ...placementFor(date, cycles) };
}

export type ConflictChoice = 'REPLACE' | 'ADD' | 'SKIP';

/** Dates des nouvelles séances qui tombent sur un jour déjà occupé. */
export function conflictDates(incoming: readonly Session[], existing: readonly Session[]): IsoDate[] {
  const incomingIds = new Set(incoming.map((s) => s.id));
  const taken = new Set(existing.filter((s) => !incomingIds.has(s.id)).map((s) => s.date));
  return [...new Set(incoming.map((s) => s.date))].filter((d) => taken.has(d)).sort();
}

export function resolveConflicts(
  incoming: readonly Session[],
  existing: readonly Session[],
  choices: Readonly<Partial<Record<IsoDate, ConflictChoice>>>,
): { save: Session[]; remove: Session[] } {
  const conflicts = new Set(conflictDates(incoming, existing));
  const choice = (date: IsoDate): ConflictChoice => (conflicts.has(date) ? (choices[date] ?? 'ADD') : 'ADD');
  const incomingIds = new Set(incoming.map((s) => s.id));
  return {
    save: incoming.filter((s) => choice(s.date) !== 'SKIP'),
    remove: existing.filter((s) => !incomingIds.has(s.id) && conflicts.has(s.date) && choice(s.date) === 'REPLACE'),
  };
}
