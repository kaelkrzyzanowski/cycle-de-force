import { useState } from 'preact/hooks';
import { newId } from '../../domain/ids';
import { followingSessions, propagateEdits } from '../../domain/sessionEdit';
import type { SessionEdit } from '../../domain/sessionEdit';
import { canQuickValidate, mapExercise, mapSet, recordSet, resetSet, validateExercise, validateSet } from '../../domain/sets';
import { sessionTotals } from '../../domain/totals';
import type { Cycle, Exercise, Maxes, Session, SessionExercise } from '../../domain/types';
import { commit } from '../actions';
import { Sheet } from '../components/Sheet';
import { useApp, useData } from '../context';
import { formatDayLong, formatKg, formatTonnage } from '../format';
import { S } from '../strings';
import { useWakeLock } from '../useWakeLock';
import { EditSession } from '../session/EditSession';
import { SetPill } from '../session/SetPill';
import { SetSheet } from '../session/SetSheet';
import type { SetDecision } from '../session/SetSheet';

const NO_MAX: Maxes = { S: 0, B: 0, D: 0 };
const RIR_VALUES = [0, 1, 2, 3, 4, 5];

interface Data {
  session: Session | undefined;
  cycle: Cycle | undefined;
  cycleSessions: Session[];
  catalogue: Exercise[];
}

export function SessionScreen({ id }: { id: string }) {
  const data = useData<Data>(async (repo) => {
    const session = await repo.getSession(id);
    const cycleId = session?.cycleId;
    return {
      session,
      cycle: cycleId ? await repo.getCycle(cycleId) : undefined,
      cycleSessions: cycleId ? await repo.listSessionsByCycle(cycleId) : [],
      catalogue: await repo.listExercises(),
    };
  }, [id]);
  if (!data) return <p class="muted">{S.loading}</p>;
  if (!data.session) return <p class="card">{S.session.notFound}</p>;
  // La clé recrée la vue si la séance est rechargée (restauration, édition…).
  return <SessionView key={JSON.stringify(data.session)} {...data} session={data.session} />;
}

type Pending = { draft: Session; edits: SessionEdit[]; newExercises: Exercise[]; following: number };

function SessionView({ session: initial, cycle, cycleSessions, catalogue }: Data & { session: Session }) {
  const app = useApp();
  const { rounding } = app.settings;
  const [session, setSession] = useState(initial);
  const [open, setOpen] = useState<{ exerciseRowId: string; index: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const max = cycle?.max ?? NO_MAX;
  useWakeLock(true);

  /** Enregistre aussitôt ; le bandeau « Annuler » restaure l'état précédent. */
  const persist = (next: Session, message?: string) => {
    const previous = session;
    setSession(next);
    navigator.vibrate?.(15);
    app.repo.saveSessions([next]).catch((err: unknown) => {
      console.error(err);
      setSession(previous);
      app.toast(S.saveError);
    });
    if (message) {
      app.toast(message, {
        label: S.session.undo,
        run: () => {
          setSession(previous);
          void app.repo.saveSessions([previous]);
        },
      });
    }
  };

  const tap = (ex: SessionExercise, index: number) => {
    const set = ex.sets.find((s) => s.index === index);
    if (!set) return;
    if (set.status === 'PLANNED' && canQuickValidate(set)) {
      persist(mapSet(session, ex.id, index, (s) => validateSet(s, max, rounding)), S.session.setValidated);
    } else if (set.status === 'VALIDATED') {
      persist(mapSet(session, ex.id, index, resetSet), S.session.setReset);
    } else {
      setOpen({ exerciseRowId: ex.id, index });
    }
  };

  const decide = (decision: SetDecision) => {
    if (!open) return;
    const next = mapSet(session, open.exerciseRowId, open.index, (s) => {
      if (decision.status === 'PLANNED') return resetSet(s);
      if (decision.status === 'NOT_DONE') return recordSet(s, 'NOT_DONE', {}, max, rounding);
      const actual = decision.kg === null ? { reps: decision.reps } : { reps: decision.reps, kg: decision.kg };
      return recordSet(s, decision.status, actual, max, rounding);
    });
    const label = decision.status === 'PLANNED' ? S.session.setReset : S.session.setRecorded(S.setStatus[decision.status]);
    setOpen(null);
    persist(next, label);
  };

  const validateAll = (ex: SessionExercise) => {
    const updated = validateExercise(ex, max, rounding);
    const count = updated.sets.filter((s, i) => s.status !== ex.sets[i]?.status).length;
    if (count > 0) persist(mapExercise(session, ex.id, () => updated), S.session.validatedAll(count));
  };

  const finishEditing = (draft: Session, edits: SessionEdit[], newExercises: Exercise[]) => {
    if (edits.length === 0) {
      setEditing(false);
      return;
    }
    const following = followingSessions(draft, cycleSessions).length;
    const pendingEdit = { draft, edits, newExercises, following };
    if (following === 0) void saveEdits(pendingEdit, false);
    else setPending(pendingEdit);
  };

  const saveEdits = async (p: Pending, propagate: boolean) => {
    const used = new Set(p.draft.exercises.map((e) => e.exerciseId));
    await Promise.all(p.newExercises.filter((e) => used.has(e.id)).map((e) => app.repo.saveExercise(e)));
    const others = propagate ? propagateEdits(p.draft, cycleSessions, p.edits, newId) : [];
    const message = others.length ? S.edit.savedIn(others.length + 1) : S.edit.saved;
    if (await commit(app, { saveSessions: [p.draft, ...others] }, message)) {
      setPending(null);
      setEditing(false);
    }
  };

  const totals = sessionTotals(session, max, rounding);
  const openExercise = open ? session.exercises.find((e) => e.id === open.exerciseRowId) : undefined;
  const openSet = openExercise?.sets.find((s) => s.index === open?.index);

  return (
    <div class="stack session">
      <section class="stack tight">
        <div class="section-header">
          <h2>{session.name}</h2>
          {!editing && (
            <button type="button" class="btn small" onClick={() => setEditing(true)}>
              {S.session.edit}
            </button>
          )}
        </div>
        <p class="muted">
          {formatDayLong(session.date)} ·{' '}
          {cycle && session.cycleWeek ? S.session.inCycle(cycle.name, session.cycleWeek) : S.session.outOfCycle}
        </p>
      </section>

      {editing ? (
        <EditSession initial={session} catalogue={catalogue} onDone={finishEditing} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div class="totals-bar" role="group" aria-label={S.session.totals}>
            <span>
              <span class="muted">{S.session.tonnage}</span> <strong class="num">{formatTonnage(totals.tonnage)}</strong>
            </span>
            <span class="num">
              {totals.reps} {S.session.reps}
            </span>
            <span class="num">
              {formatKg(totals.kgPerRep)} {S.session.kgPerRep}
            </span>
          </div>

          {session.exercises.length === 0 && <p class="card muted">{S.session.empty}</p>}

          {session.exercises.map((ex) => (
            <section key={ex.id} class="card stack tight exercise-card">
              <div class="section-header">
                <h3>{ex.name}</h3>
                {ex.sets.some((s) => s.status === 'PLANNED' && canQuickValidate(s)) && (
                  <button type="button" class="btn small" onClick={() => validateAll(ex)}>
                    ✓ {S.session.validateAll}
                  </button>
                )}
              </div>
              <div class="set-row">
                {ex.sets.map((set) => (
                  <SetPill
                    key={set.index}
                    set={set}
                    max={max}
                    rounding={rounding}
                    onTap={() => tap(ex, set.index)}
                    onLongPress={() => setOpen({ exerciseRowId: ex.id, index: set.index })}
                  />
                ))}
              </div>
              <div class="rir-row">
                <span class="muted">{S.session.rir}</span>
                <div class="segmented small" role="group" aria-label={S.session.rirOf(ex.name)}>
                  {RIR_VALUES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      class="num"
                      aria-pressed={ex.rir === r}
                      onClick={() => persist(mapExercise(session, ex.id, (e) => withOptional(e, 'rir', e.rir === r ? undefined : r)))}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                class="text-input note"
                rows={1}
                placeholder={S.session.note}
                aria-label={S.session.exerciseNote(ex.name)}
                value={ex.note ?? ''}
                onChange={(e) => persist(mapExercise(session, ex.id, (x) => withOptional(x, 'note', e.currentTarget.value.trim() || undefined)))}
              />
            </section>
          ))}

          <label class="field">
            <span>{S.session.sessionNote}</span>
            <textarea
              class="text-input note"
              rows={2}
              value={session.note ?? ''}
              onChange={(e) => persist(withOptional(session, 'note', e.currentTarget.value.trim() || undefined))}
            />
          </label>
        </>
      )}

      {openExercise && openSet && (
        <SetSheet
          set={openSet}
          exerciseName={openExercise.name}
          max={max}
          rounding={rounding}
          onDecide={decide}
          onClose={() => setOpen(null)}
        />
      )}

      {pending && (
        <Sheet title={S.edit.scopeTitle} onClose={() => setPending(null)}>
          <div class="choice-list">
            <button type="button" class="choice" onClick={() => void saveEdits(pending, false)}>
              {S.edit.scopeThis}
            </button>
            <button type="button" class="choice" onClick={() => void saveEdits(pending, true)}>
              {S.edit.scopeFollowing(pending.following)}
            </button>
          </div>
          <p class="muted">{S.edit.scopeNote}</p>
        </Sheet>
      )}
    </div>
  );
}

/** Pose ou retire un champ optionnel sans laisser de clé `undefined` dans la base. */
function withOptional<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): T {
  const copy = { ...obj };
  if (value === undefined) delete copy[key];
  else copy[key] = value;
  return copy;
}
