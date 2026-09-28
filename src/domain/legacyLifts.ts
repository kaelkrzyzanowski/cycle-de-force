import type { Exercise } from './types';

/**
 * Avant la v2 des données, les RM étaient limités à trois mouvements codés en dur (S/B/D).
 * Chacun devient un exercice « avec RM » du catalogue.
 */
export const LEGACY_LIFTS: Record<string, Exercise> = {
  S: { id: 'squat', name: 'Squat', aliases: [], hasMax: true, short: 'S' },
  B: { id: 'developpe-couche', name: 'Développé couché', aliases: ['DC', 'Bench'], hasMax: true, short: 'B' },
  D: { id: 'souleve-de-terre', name: 'Soulevé de terre', aliases: ['Deadlift', 'SDT'], hasMax: true, short: 'D' },
};

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): Json[] => (Array.isArray(v) ? v.filter(isRecord) : []);
const liftId = (v: unknown): unknown => (typeof v === 'string' ? (LEGACY_LIFTS[v]?.id ?? v) : v);

function migrateLoad(load: unknown): unknown {
  if (!isRecord(load) || load['kind'] !== 'PERCENT' || !('lift' in load)) return load;
  const { lift, ...rest } = load;
  return { ...rest, of: liftId(lift) };
}

const migrateSets = (sets: unknown): unknown =>
  Array.isArray(sets) ? sets.map((s) => (isRecord(s) ? { ...s, load: migrateLoad(s['load']) } : s)) : sets;

const migrateExercises = (exercises: unknown): unknown =>
  Array.isArray(exercises) ? exercises.map((e) => (isRecord(e) ? { ...e, sets: migrateSets(e['sets']) } : e)) : exercises;

function migrateMaxes(max: unknown): unknown {
  if (!isRecord(max)) return max;
  return Object.fromEntries(Object.entries(max).map(([k, v]) => [liftId(k), v]));
}

/**
 * Passe des données au format « RM par exercice » : les % et les max référencent un exercice,
 * les trois anciens mouvements deviennent des exercices avec RM, et tout exercice utilisé par un
 * modèle ou une séance est ajouté au catalogue s'il y manque. Idempotent.
 */
export function migrateLegacyLifts<T extends Json>(data: T): T {
  const templates = list(data['templates']).map((t) => {
    const weeks = isRecord(t['weeks']) ? t['weeks'] : {};
    return { ...t, weeks: Object.fromEntries(Object.entries(weeks).map(([w, ex]) => [w, migrateExercises(ex)])) };
  });
  const sessions = list(data['sessions']).map((s) => ({ ...s, exercises: migrateExercises(s['exercises']) }));
  const cycles = list(data['cycles']).map((c) => ({ ...c, max: migrateMaxes(c['max']) }));
  const maxChanges = list(data['maxChanges']).map((m) => {
    if (!('lift' in m)) return m;
    const { lift, ...rest } = m;
    return { ...rest, exerciseId: liftId(lift) };
  });

  const catalogue = new Map<string, Json>();
  for (const e of list(data['exercises'])) {
    const { defaultLift, ...rest } = e;
    catalogue.set(String(e['id']), defaultLift === undefined ? rest : { ...rest, defaultMax: liftId(defaultLift) });
  }
  for (const legacy of Object.values(LEGACY_LIFTS)) {
    const existing = catalogue.get(legacy.id);
    catalogue.set(legacy.id, existing ? { short: legacy.short, ...existing, hasMax: true } : { ...legacy, aliases: [...legacy.aliases] });
  }
  const used = [
    ...templates.flatMap((t) => Object.values(t.weeks).flatMap((w) => list(w))),
    ...sessions.flatMap((s) => list(s.exercises)),
  ];
  for (const e of used) {
    const id = e['exerciseId'];
    if (typeof id !== 'string' || catalogue.has(id)) continue;
    const percent = list(e['sets']).map((s) => s['load']).find((l) => isRecord(l) && l['kind'] === 'PERCENT');
    const defaultMax = isRecord(percent) ? percent['of'] : undefined;
    catalogue.set(id, { id, name: String(e['name'] ?? id), aliases: [], ...(typeof defaultMax === 'string' ? { defaultMax } : {}) });
  }

  return { ...data, templates, sessions, cycles, maxChanges, exercises: [...catalogue.values()] };
}
