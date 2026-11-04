import { useState } from 'preact/hooks';
import { copySessionAsPlanned, hasRealizedSets, moveSession, placementFor } from '../../domain/cycles';
import { newId } from '../../domain/ids';
import type { Cycle, Session } from '../../domain/types';
import { commit } from '../actions';
import { DateField, TextField } from '../components/fields';
import { Sheet } from '../components/Sheet';
import { useApp } from '../context';
import { formatDayMedium } from '../format';
import { href, navigate } from '../router';
import { S } from '../strings';

type Mode = 'menu' | 'rename' | 'move' | 'duplicate' | 'delete';

export function SessionActionsSheet({
  session,
  label,
  cycles,
  onClose,
}: {
  session: Session;
  label: string;
  cycles: readonly Cycle[];
  onClose: () => void;
}) {
  const app = useApp();
  const [mode, setMode] = useState<Mode>('menu');
  const [date, setDate] = useState(session.date);
  const [name, setName] = useState(label);

  const run = async (ok: Promise<boolean>) => {
    if (await ok) onClose();
  };
  const move = () =>
    run(commit(app, { saveSessions: [moveSession(session, date, cycles)] }, S.sessionActions.moved(formatDayMedium(date))));
  const duplicate = () =>
    run(
      commit(
        app,
        { saveSessions: [copySessionAsPlanned(session, placementFor(date, cycles), newId)] },
        S.sessionActions.duplicated(formatDayMedium(date)),
      ),
    );
  const rename = () =>
    run(commit(app, { saveSessions: [{ ...session, name: name.trim() }] }, S.sessionActions.renamed(name.trim())));
  const remove = () => run(commit(app, { deleteSessionIds: [session.id] }, S.sessionActions.deleted));

  const title = `${label} · ${formatDayMedium(session.date)}`;

  return (
    <Sheet title={title} onClose={onClose}>
      {mode === 'menu' && (
        <div class="choice-list">
          <button type="button" class="choice" onClick={() => navigate(href.session(session.id))}>
            {S.sessionActions.open}
          </button>
          <button type="button" class="choice" onClick={() => setMode('rename')}>
            {S.sessionActions.rename}
          </button>
          <button type="button" class="choice" onClick={() => setMode('move')}>
            {S.sessionActions.move}
          </button>
          <button type="button" class="choice" onClick={() => setMode('duplicate')}>
            {S.sessionActions.duplicate}
          </button>
          <button
            type="button"
            class="choice danger"
            onClick={() => (hasRealizedSets(session) ? setMode('delete') : remove())}
          >
            {S.sessionActions.delete}
          </button>
        </div>
      )}
      {mode === 'rename' && (
        <form
          class="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() !== '') void rename();
          }}
        >
          <TextField label={S.sessionActions.newName} value={name} onChange={setName} />
          <div class="button-row">
            <button type="button" class="btn" onClick={() => setMode('menu')}>
              {S.common.cancel}
            </button>
            <button type="submit" class="btn primary" disabled={name.trim() === ''}>
              {S.sessionActions.confirmRename}
            </button>
          </div>
        </form>
      )}
      {(mode === 'move' || mode === 'duplicate') && (
        <div class="stack">
          <DateField label={S.sessionActions.targetDate} value={date} onChange={setDate} />
          {mode === 'move' && <p class="muted">{S.calendar.dragHint}</p>}
          <div class="button-row">
            <button type="button" class="btn" onClick={() => setMode('menu')}>
              {S.common.cancel}
            </button>
            <button type="button" class="btn primary" onClick={mode === 'move' ? move : duplicate}>
              {mode === 'move' ? S.sessionActions.confirmMove : S.sessionActions.confirmDuplicate}
            </button>
          </div>
        </div>
      )}
      {mode === 'delete' && (
        <div class="stack">
          <p>{S.sessionActions.confirmDelete}</p>
          <div class="button-row">
            <button type="button" class="btn" onClick={() => setMode('menu')}>
              {S.common.cancel}
            </button>
            <button type="button" class="btn danger" onClick={remove}>
              {S.sessionActions.confirmDeleteButton}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
