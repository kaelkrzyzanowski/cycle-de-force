import { useState } from 'preact/hooks';
import { renameExercise } from '../../domain/exercises';
import { slugify } from '../../domain/ids';
import type { Exercise } from '../../domain/types';
import { commit } from '../actions';
import { TextField } from '../components/fields';
import { NumberField } from '../components/NumberField';
import { Sheet } from '../components/Sheet';
import { useApp } from '../context';
import { formatKg } from '../format';
import { S } from '../strings';

const ALL_DATES = ['0000-01-01', '9999-12-31'] as const;

/** Catalogue d'exercices : nom, RM actuel (base des %) et abréviation. */
export function ExercisesScreen() {
  const app = useApp();
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const exercises = [...app.exercises.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return (
    <div class="stack">
      <p class="muted">{S.exercises.intro}</p>
      {exercises.length === 0 && (
        <section class="card">
          <p>{S.exercises.empty}</p>
        </section>
      )}
      <ul class="stack tight exercise-list">
        {exercises.map((e) => (
          <li key={e.id}>
            <button type="button" class="card exercise-row" onClick={() => setEditing(e)}>
              <span class="name">{e.name}</span>
              <span class={`num${e.max ? '' : ' muted'}`}>{e.max ? S.exercises.rm(formatKg(e.max)) : S.exercises.noRm}</span>
            </button>
          </li>
        ))}
      </ul>
      <div class="button-row sticky-actions">
        <button type="button" class="btn primary" onClick={() => setEditing('new')}>
          + {S.exercises.new}
        </button>
      </div>
      {editing && <ExerciseSheet exercise={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ExerciseSheet({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const app = useApp();
  const [name, setName] = useState(exercise?.name ?? '');
  const [max, setMax] = useState(exercise?.max ?? 0);
  const [short, setShort] = useState(exercise?.short ?? '');
  const trimmed = name.trim();
  // Un nom (ou un alias) déjà pris par un autre exercice : on évite les doublons.
  const clash = [...app.exercises.values()].find(
    (e) => e.id !== exercise?.id && [e.name, ...e.aliases].some((n) => slugify(n) === slugify(trimmed)),
  );

  const save = async () => {
    const base: Exercise = exercise ?? { id: slugify(trimmed), name: trimmed, aliases: [] };
    const next: Exercise = {
      ...base,
      name: trimmed,
      max: max > 0 ? max : undefined,
      hasMax: max > 0 ? true : base.hasMax,
      short: short.trim() || undefined,
    };
    // Renommé : le nom recopié dans les modèles et les séances suit.
    const renamed =
      exercise && trimmed !== exercise.name
        ? renameExercise(exercise.id, trimmed, await app.repo.listTemplates(), await app.repo.listSessionsBetween(...ALL_DATES))
        : { templates: [], sessions: [] };
    const ok = await commit(
      app,
      { saveExercises: [next], saveTemplates: renamed.templates, saveSessions: renamed.sessions },
      exercise ? S.exercises.saved : S.exercises.created(trimmed),
    );
    if (ok) onClose();
  };

  return (
    <Sheet title={exercise ? exercise.name : S.exercises.new} onClose={onClose}>
      <TextField label={S.exercises.name} value={name} onChange={setName} />
      {clash && <p class="warning">{S.exercises.clash(clash.name)}</p>}
      <NumberField label={S.exercises.max} value={max} onChange={setMax} step={2.5} max={999} suffix="kg" buttons={false} />
      <p class="muted">{S.exercises.maxHint}</p>
      <TextField label={S.exercises.short} value={short} onChange={setShort} />
      <p class="muted">{S.exercises.shortHint}</p>
      <button type="button" class="btn primary" disabled={trimmed === '' || !!clash} onClick={() => void save()}>
        {S.exercises.save}
      </button>
    </Sheet>
  );
}
