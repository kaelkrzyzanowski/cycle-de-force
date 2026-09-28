import { slugify } from '../../domain/ids';
import type { Exercise } from '../../domain/types';

const key = (s: string): string => slugify(s);

/** Retrouve un exercice du catalogue par nom ou alias ; sinon en crée un nouveau. */
export function resolveExercise(name: string, catalogue: readonly Exercise[]): { exercise: Exercise; isNew: boolean } {
  const wanted = key(name);
  const found = catalogue.find((e) => e.id === wanted || key(e.name) === wanted || e.aliases.some((a) => key(a) === wanted));
  if (found) return { exercise: found, isNew: false };
  return { exercise: { id: wanted, name: name.trim(), aliases: [] }, isNew: true };
}

/**
 * RM proposé quand on passe une série de cet exercice en % : le sien s'il en a un, sinon son RM
 * par défaut, sinon celui dont le nom (ou un alias) apparaît dans le sien (« Squat pause » → Squat).
 */
export function defaultMaxFor(exerciseId: string, catalogue: readonly Exercise[]): string | undefined {
  const withMax = catalogue.filter((e) => e.hasMax);
  const exercise = catalogue.find((e) => e.id === exerciseId);
  if (exercise?.hasMax) return exercise.id;
  if (exercise?.defaultMax && withMax.some((e) => e.id === exercise.defaultMax)) return exercise.defaultMax;
  const words = `-${key(exercise?.name ?? exerciseId)}-`;
  const match = withMax.find((e) => [e.name, ...e.aliases].some((n) => words.includes(`-${key(n)}-`)));
  return (match ?? withMax[0])?.id;
}
