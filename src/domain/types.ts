/** Dates ISO locales sans heure : 'AAAA-MM-JJ'. */
export type IsoDate = string;

export type Lift = 'S' | 'B' | 'D';
export const LIFTS: readonly Lift[] = ['S', 'B', 'D'];

export type Maxes = Record<Lift, number>;

export type SetStatus = 'PLANNED' | 'VALIDATED' | 'FAILED' | 'NOT_DONE' | 'CLUSTER';
export type RealizedStatus = 'VALIDATED' | 'FAILED' | 'CLUSTER';

export type LoadRule =
  | { kind: 'FIXED'; kg: number }
  | { kind: 'PERCENT'; lift: Lift; pct: number } // pct = 0.70 pour 70 %
  | { kind: 'BODYWEIGHT'; extraKg?: number } // tractions, dips lestés
  | { kind: 'NONE' }; // charge libre, à saisir (Iso SBD, Joker)

export interface SetPrescription {
  reps: number; // 0 = à saisir
  load: LoadRule;
}

export interface ExercisePrescription {
  exerciseId: string;
  name: string;
  sets: SetPrescription[];
  note?: string;
}

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = lundi

export interface SessionTemplate {
  id: string;
  name: string;
  color: string;
  native: boolean;
  weeksCount: number;
  /** Prescription par semaine de cycle (1..weeksCount). */
  weeks: Record<number, ExercisePrescription[]>;
}

export interface Cycle {
  id: string;
  name: string;
  startDate: IsoDate; // un lundi
  weeksCount: number;
  max: Maxes;
  weeklyPlan: { weekday: Weekday; templateId: string }[];
  notes?: string;
}

export interface MaxChange {
  id: string;
  cycleId: string;
  lift: Lift;
  from: number;
  to: number;
  at: string; // horodatage ISO complet
}

export interface SessionSet {
  index: number;
  plannedReps: number;
  load: LoadRule; // la charge prévue est calculée à l'affichage depuis load + max du cycle
  status: SetStatus;
  /** Figés dès que la série passe à un statut réalisé. */
  actualReps?: number;
  actualKg?: number;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  name: string;
  position: number;
  sets: SessionSet[];
  rir?: number;
  note?: string;
}

export interface Session {
  id: string;
  cycleId: string | null;
  templateId: string | null;
  cycleWeek: number | null;
  date: IsoDate;
  name: string;
  exercises: SessionExercise[];
  rir?: number;
  note?: string;
}

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  defaultLift?: Lift;
}

export type Rounding = 0 | 0.5 | 1 | 1.25 | 2.5;
export type ThemePref = 'dark' | 'light' | 'system';

export interface Settings {
  rounding: Rounding;
  theme: ThemePref;
  weekStartsOn: 1;
  lastBackupAt?: string;
  backupReminderDays: number;
}

export const DEFAULT_SETTINGS: Settings = {
  rounding: 1,
  theme: 'dark',
  weekStartsOn: 1,
  backupReminderDays: 7,
};
