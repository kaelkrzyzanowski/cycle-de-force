import { sessionFromTemplate } from './cycles';
import type { ExercisePrescription, IsoDate, Lift, Session, SessionTemplate } from './types';

type NewId = () => string;

export const TEMPLATE_COLORS = ['#b5452f', '#c9a227', '#3d6fd1', '#2a9d8f', '#c2417a', '#6b8e23', '#8d6e63', '#6b7280'];

export function emptyTemplate(name: string, weeksCount: number, color: string, newId: NewId): SessionTemplate {
  const weeks: Record<number, ExercisePrescription[]> = {};
  for (let w = 1; w <= weeksCount; w++) weeks[w] = [];
  return { id: `tpl-${newId()}`, name, color, native: false, weeksCount, weeks };
}

/** Copie indépendante et modifiable (un modèle perso, même à partir d'un natif). */
export function duplicateTemplate(template: SessionTemplate, name: string, newId: NewId): SessionTemplate {
  return { ...structuredClone(template), id: `tpl-${newId()}`, name, native: false };
}

/** Ajoute des semaines (copies de la dernière) ou retire les dernières. */
export function setWeeksCount(template: SessionTemplate, count: number): SessionTemplate {
  const weeks: Record<number, ExercisePrescription[]> = {};
  const last = template.weeks[template.weeksCount] ?? [];
  for (let w = 1; w <= count; w++) weeks[w] = structuredClone(template.weeks[w] ?? last);
  return { ...template, weeksCount: count, weeks };
}

/** « Copier la semaine k vers… » : remplace chaque semaine cible par une copie de la semaine source. */
export function copyWeek(template: SessionTemplate, from: number, targets: readonly number[]): SessionTemplate {
  const source = template.weeks[from] ?? [];
  const weeks = { ...template.weeks };
  for (const w of targets) if (w !== from && w >= 1 && w <= template.weeksCount) weeks[w] = structuredClone(source);
  return { ...template, weeks };
}

export interface Progression {
  exerciseId: string;
  lift: Lift;
  /** Pourcentages en fraction : 0.65 pour 65 %. */
  from: number;
  to: number;
  step: number;
  weeks: readonly number[];
}

/** Pourcentage de chaque semaine choisie : from, from + step… sans dépasser to. */
export function progressionValues(p: Pick<Progression, 'from' | 'to' | 'step' | 'weeks'>): { week: number; pct: number }[] {
  const up = p.to >= p.from;
  const step = Math.abs(p.step) * (up ? 1 : -1);
  return [...p.weeks]
    .sort((a, b) => a - b)
    .map((week, i) => {
      const raw = p.from + i * step;
      const pct = up ? Math.min(raw, p.to) : Math.max(raw, p.to);
      return { week, pct: Math.round(pct * 10_000) / 10_000 };
    });
}

/**
 * « Appliquer une progression » : sur chaque semaine choisie où l'exercice est présent,
 * toutes ses séries passent à X % du max du mouvement choisi.
 */
export function applyProgression(template: SessionTemplate, p: Progression): { template: SessionTemplate; skipped: number[] } {
  const weeks = { ...template.weeks };
  const skipped: number[] = [];
  for (const { week, pct } of progressionValues(p)) {
    const list = weeks[week] ?? [];
    if (!list.some((e) => e.exerciseId === p.exerciseId)) {
      skipped.push(week);
      continue;
    }
    weeks[week] = list.map((e) =>
      e.exerciseId !== p.exerciseId ? e : { ...e, sets: e.sets.map((s) => ({ ...s, load: { kind: 'PERCENT', lift: p.lift, pct } })) },
    );
  }
  return { template: { ...template, weeks }, skipped };
}

/** Semaine de modèle vue comme une séance (toutes séries prévues), pour réutiliser l'éditeur de séance. */
export function weekAsSession(template: SessionTemplate, week: number): Session {
  return {
    id: `${template.id}-S${week}`,
    cycleId: null,
    templateId: template.id,
    cycleWeek: week,
    date: '1970-01-01',
    name: template.name,
    exercises: (template.weeks[week] ?? []).map((p, position) => ({
      id: `${p.exerciseId}-${position}`,
      exerciseId: p.exerciseId,
      name: p.name,
      position,
      sets: p.sets.map((s, index) => ({ index, plannedReps: s.reps, load: structuredClone(s.load), status: 'PLANNED' })),
      ...(p.note ? { note: p.note } : {}),
    })),
  };
}

export function sessionAsWeek(session: Session): ExercisePrescription[] {
  return session.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    name: e.name,
    sets: e.sets.map((s) => ({ reps: s.plannedReps, load: structuredClone(s.load) })),
    ...(e.note ? { note: e.note } : {}),
  }));
}

/** Séances à venir de ce modèle dont aucune série n'a encore été touchée. */
export function untouchedFutureSessions(template: SessionTemplate, sessions: readonly Session[], today: IsoDate): Session[] {
  return sessions.filter(
    (s) =>
      s.templateId === template.id &&
      s.date >= today &&
      s.exercises.every((e) => e.sets.every((x) => x.status === 'PLANNED') && e.rir === undefined && e.note === undefined) &&
      s.note === undefined,
  );
}

/** Reprend la prescription du modèle (semaine de cycle de chaque séance) ; garde date, cycle et identifiant. */
export function refreshFromTemplate(template: SessionTemplate, sessions: readonly Session[], newId: NewId): Session[] {
  return sessions.map((s) => {
    const fresh = sessionFromTemplate(template, s.cycleWeek ?? 1, { date: s.date, cycleId: s.cycleId, cycleWeek: s.cycleWeek }, newId);
    return { ...fresh, id: s.id };
  });
}
