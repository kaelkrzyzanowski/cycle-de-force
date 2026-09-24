import { useState } from 'preact/hooks';
import { newId } from '../../domain/ids';
import { applyEdit, pushEdit } from '../../domain/sessionEdit';
import type { SessionEdit } from '../../domain/sessionEdit';
import { LIFTS } from '../../domain/types';
import type { Exercise, Lift, LoadRule, Session, SessionExercise, SessionSet } from '../../domain/types';
import { useApp } from '../context';
import { formatKg, parseDecimal } from '../format';
import { S } from '../strings';
import { resolveExercise } from './catalog';

export const CATALOGUE_LIST_ID = 'exercise-catalogue';

interface Props {
  initial: Session;
  catalogue: readonly Exercise[];
  onDone: (draft: Session, edits: SessionEdit[], newExercises: Exercise[]) => void;
  onCancel: () => void;
}

/** Édition de la prescription ; chaque geste devient une opération rejouable sur les semaines suivantes. */
export function EditSession({ initial, catalogue, onDone, onCancel }: Props) {
  const app = useApp();
  const [draft, setDraft] = useState(initial);
  const [edits, setEdits] = useState<SessionEdit[]>([]);
  const [newExercises, setNewExercises] = useState<Exercise[]>([]);
  const [newName, setNewName] = useState('');
  const known = [...catalogue, ...newExercises];

  const dispatch = (edit: SessionEdit) => {
    const next = applyEdit(draft, edit, newId);
    if (!next) return;
    setDraft(next);
    setEdits((list) => pushEdit(list, edit));
  };

  const resolve = (name: string): Exercise => {
    const { exercise, isNew } = resolveExercise(name, known);
    if (isNew) setNewExercises((list) => [...list, exercise]);
    return exercise;
  };

  const addExercise = () => {
    if (newName.trim() === '') return;
    const exercise = resolve(newName);
    if (draft.exercises.some((e) => e.exerciseId === exercise.id)) {
      app.toast(S.edit.duplicateExercise);
      return;
    }
    const load: LoadRule = { kind: 'NONE' };
    dispatch({ kind: 'addExercise', exerciseId: exercise.id, name: exercise.name, sets: [0, 1, 2].map(() => ({ reps: 8, load })) });
    setNewName('');
  };

  return (
    <div class="stack">
      <datalist id={CATALOGUE_LIST_ID}>
        {known.map((e) => (
          <option key={e.id} value={e.name} />
        ))}
      </datalist>

      <label class="field">
        <span>{S.edit.sessionName}</span>
        <input
          class="text-input"
          value={draft.name}
          onChange={(e) => {
            const name = e.currentTarget.value.trim();
            if (name) dispatch({ kind: 'renameSession', name });
          }}
        />
      </label>

      {draft.exercises.map((ex, i) => (
        <ExerciseEditor
          key={ex.id}
          ex={ex}
          position={i}
          last={i === draft.exercises.length - 1}
          defaultLift={known.find((k) => k.id === ex.exerciseId)?.defaultLift ?? 'S'}
          dispatch={dispatch}
          resolve={resolve}
        />
      ))}

      <section class="card stack tight">
        <label class="field">
          <span>{S.edit.newExerciseName}</span>
          <input
            class="text-input"
            list={CATALOGUE_LIST_ID}
            value={newName}
            onInput={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && addExercise()}
          />
        </label>
        <button type="button" class="btn" onClick={addExercise} disabled={newName.trim() === ''}>
          + {S.edit.addExercise}
        </button>
      </section>

      <div class="button-row sticky-actions">
        <button type="button" class="btn" onClick={onCancel}>
          {S.edit.cancel}
        </button>
        <button type="button" class="btn primary" onClick={() => onDone(draft, edits, newExercises)}>
          {S.edit.done}
        </button>
      </div>
    </div>
  );
}

interface ExerciseEditorProps {
  ex: SessionExercise;
  position: number;
  last: boolean;
  defaultLift: Lift;
  dispatch: (edit: SessionEdit) => void;
  resolve: (name: string) => Exercise;
}

function ExerciseEditor({ ex, position, last, defaultLift, dispatch, resolve }: ExerciseEditorProps) {
  const locked = ex.sets.some((s) => s.status !== 'PLANNED');
  const lastSet = ex.sets.at(-1);
  return (
    <section class="card stack tight">
      <div class="edit-exercise-header">
        <input
          class="text-input"
          list={CATALOGUE_LIST_ID}
          aria-label={S.edit.exerciseName(position + 1)}
          value={ex.name}
          disabled={locked}
          onChange={(e) => {
            const name = e.currentTarget.value.trim();
            if (!name) return;
            const exercise = resolve(name);
            dispatch({ kind: 'renameExercise', exerciseId: ex.exerciseId, newExerciseId: exercise.id, name: exercise.name });
          }}
        />
        <button
          type="button"
          class="icon-btn"
          aria-label={S.edit.moveUp(ex.name)}
          disabled={position === 0}
          onClick={() => dispatch({ kind: 'moveExercise', exerciseId: ex.exerciseId, delta: -1 })}
        >
          ↑
        </button>
        <button
          type="button"
          class="icon-btn"
          aria-label={S.edit.moveDown(ex.name)}
          disabled={last}
          onClick={() => dispatch({ kind: 'moveExercise', exerciseId: ex.exerciseId, delta: 1 })}
        >
          ↓
        </button>
        <button
          type="button"
          class="icon-btn danger-text"
          aria-label={S.edit.removeExercise(ex.name)}
          disabled={locked}
          onClick={() => dispatch({ kind: 'removeExercise', exerciseId: ex.exerciseId })}
        >
          ✕
        </button>
      </div>

      {ex.sets.map((set) => (
        <SetEditor key={set.index} set={set} exerciseId={ex.exerciseId} defaultLift={defaultLift} dispatch={dispatch} />
      ))}

      <button
        type="button"
        class="btn small"
        onClick={() =>
          dispatch({
            kind: 'addSet',
            exerciseId: ex.exerciseId,
            set: lastSet ? { reps: lastSet.plannedReps, load: lastSet.load } : { reps: 5, load: { kind: 'NONE' } },
          })
        }
      >
        + {S.edit.addSet}
      </button>
    </section>
  );
}

type Kind = LoadRule['kind'];

function ruleValue(rule: LoadRule): string {
  switch (rule.kind) {
    case 'FIXED':
      return formatKg(rule.kg);
    case 'PERCENT':
      return formatKg(Math.round(rule.pct * 1000) / 10);
    case 'BODYWEIGHT':
      return formatKg(rule.extraKg ?? 0);
    case 'NONE':
      return '';
  }
}

function buildRule(kind: Kind, value: number, lift: Lift): LoadRule {
  switch (kind) {
    case 'FIXED':
      return { kind, kg: value };
    case 'PERCENT':
      return { kind, lift, pct: Math.round(value * 10) / 1000 };
    case 'BODYWEIGHT':
      return value > 0 ? { kind, extraKg: value } : { kind };
    case 'NONE':
      return { kind };
  }
}

function SetEditor({
  set,
  exerciseId,
  defaultLift,
  dispatch,
}: {
  set: SessionSet;
  exerciseId: string;
  defaultLift: Lift;
  dispatch: (edit: SessionEdit) => void;
}) {
  const n = set.index + 1;
  if (set.status !== 'PLANNED') {
    return (
      <div class="set-editor is-locked">
        <span class="set-index">S{n}</span>
        <span class="muted">{S.edit.locked}</span>
      </div>
    );
  }
  const lift = set.load.kind === 'PERCENT' ? set.load.lift : defaultLift;
  const value = parseDecimal(ruleValue(set.load)) ?? 0;
  const update = (reps: number, load: LoadRule) => dispatch({ kind: 'updateSet', exerciseId, index: set.index, reps, load });

  return (
    <div class="set-editor">
      <span class="set-index">S{n}</span>
      <input
        class="text-input num small-input"
        inputMode="numeric"
        aria-label={S.edit.setReps(n)}
        value={String(set.plannedReps)}
        onChange={(e) => {
          const reps = parseDecimal(e.currentTarget.value);
          if (reps !== null && reps >= 0) update(Math.round(reps), set.load);
        }}
      />
      <span aria-hidden="true">×</span>
      <select
        class="text-input"
        aria-label={S.edit.setLoadKind(n)}
        value={set.load.kind}
        onChange={(e) => update(set.plannedReps, buildRule(e.currentTarget.value as Kind, value, lift))}
      >
        {(Object.keys(S.edit.loadKinds) as Kind[]).map((k) => (
          <option key={k} value={k}>
            {S.edit.loadKinds[k]}
          </option>
        ))}
      </select>
      {set.load.kind !== 'NONE' && (
        <input
          class="text-input num small-input"
          inputMode="decimal"
          aria-label={S.edit.setLoadValue(n)}
          value={ruleValue(set.load)}
          onChange={(e) => {
            const v = parseDecimal(e.currentTarget.value);
            if (v !== null && v >= 0) update(set.plannedReps, buildRule(set.load.kind, v, lift));
          }}
        />
      )}
      {set.load.kind === 'PERCENT' && (
        <select
          class="text-input"
          aria-label={S.edit.setLift(n)}
          value={lift}
          onChange={(e) => update(set.plannedReps, buildRule('PERCENT', value, e.currentTarget.value as Lift))}
        >
          {LIFTS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        class="icon-btn danger-text"
        aria-label={S.edit.removeSet(n)}
        onClick={() => dispatch({ kind: 'removeSet', exerciseId, index: set.index })}
      >
        ✕
      </button>
    </div>
  );
}
