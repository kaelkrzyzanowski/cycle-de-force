import { sessionFromTemplate } from './cycles';
import type { ExercisePrescription, IsoDate, Lift, Session, SessionTemplate } from './types';

type NewId = () => string;

/**
 * Numéro de semaine dans la vague propre au modèle : S0 = deload, puis 1, 2… (test au RM en dernier).
 * null si le modèle n'a pas de semaine de deload.
 */
export function waveWeek(template: Pick<SessionTemplate, 'deloadWeek' | 'weeksCount'>, cycleWeek: number): number | null {
  if (!template.deloadWeek) return null;
  const n = template.weeksCount;
  return (((cycleWeek - template.deloadWeek) % n) + n) % n;
}

/** Nom affiché d'une séance : « Deadlift S3 » si son modèle a une vague numérotée. */
export function sessionLabel(
  session: Pick<Session, 'name' | 'cycleWeek' | 'templateId'>,
  template: Pick<SessionTemplate, 'id' | 'deloadWeek' | 'weeksCount'> | undefined,
): string {
  if (!template || session.templateId !== template.id || session.cycleWeek === null) return session.name;
  const week = waveWeek(template, session.cycleWeek);
  return week === null ? session.name : `${session.name} S${week}`;
}

export const TEMPLATE_COLORS =['#b5452f', '#c9a227', '#3d6fd1', '#2a9d8f', '#c2417a', '#6b8e23', '#8d6e63', '#6b7280'];

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
 * Semaines choisies où l'exercice est pratiqué, et celles où il est absent (deload) :
 * une semaine absente ne fait pas avancer la progression.
 */
export function progressionWeeks(template: SessionTemplate, exerciseId: string, weeks: readonly number[]) {
  const has = (w: number) => (template.weeks[w] ?? []).some((e) => e.exerciseId === exerciseId);
  const sorted = [...weeks].sort((a, b) => a - b);
  return { present: sorted.filter(has), skipped: sorted.filter((w) => !has(w)) };
}

/**
 * « Appliquer une progression » : sur les semaines choisies où l'exercice est pratiqué,
 * toutes ses séries passent à X % du max du mouvement choisi, X avançant d'un pas par semaine pratiquée.
 */
export function applyProgression(template: SessionTemplate, p: Progression): { template: SessionTemplate; skipped: number[] } {
  const weeks = { ...template.weeks };
  const { present, skipped } = progressionWeeks(template, p.exerciseId, p.weeks);
  for (const { week, pct } of progressionValues({ ...p, weeks: present })) {
    const list = weeks[week] ?? [];
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

/**
 * Reprend la prescription du modèle (semaine de cycle de chaque séance) ; garde date, cycle et identifiant.
 * Ne renvoie que les séances dont le contenu change réellement.
 */
export function refreshFromTemplate(template: SessionTemplate, sessions: readonly Session[], newId: NewId): Session[] {
  const content = (s: Session) => JSON.stringify([s.name, sessionAsWeek(s)]);
  return sessions.flatMap((s) => {
    const fresh = sessionFromTemplate(template, s.cycleWeek ?? 1, { date: s.date, cycleId: s.cycleId, cycleWeek: s.cycleWeek }, newId);
    return content(fresh) === content(s) ? [] : [{ ...fresh, id: s.id }];
  });
}
