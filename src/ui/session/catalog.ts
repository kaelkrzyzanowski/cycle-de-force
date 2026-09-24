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
