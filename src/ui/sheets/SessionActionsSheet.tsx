import { useState } from 'preact/hooks';
import { copySessionAsPlanned, hasRealizedSets, moveSession, placementFor } from '../../domain/cycles';
import { newId } from '../../domain/ids';
import type { Cycle, Session } from '../../domain/types';
import { commit } from '../actions';
import { DateField } from '../components/fields';
import { Sheet } from '../components/Sheet';
import { useApp } from '../context';
import { formatDayMedium } from '../format';
import { href, navigate } from '../router';
import { S } from '../strings';

type Mode = 'menu' | 'move' | 'duplicate' | 'delete';

export function SessionActionsSheet({ session, cycles, onClose }: { session: Session; cycles: readonly Cycle[]; onClose: () => void }) {
  const app = useApp();
  const [mode, setMode] = useState<Mode>('menu');
  const [date, setDate] = useState(session.date);

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
  const remove = () => run(commit(app, { deleteSessionIds: [session.id] }, S.sessionActions.deleted));

  const title = `${session.name} · ${formatDayMedium(session.date)}`;

  return (
    <Sheet title={title} onClose={onClose}>
      {mode === 'menu' && (
        <div class="choice-list">
          <button type="button" class="choice" onClick={() => navigate(href.session(session.id))}>
            {S.sessionActions.open}
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
      {(mode === 'move' || mode === 'duplicate') && (
        <div class="stack">
          <DateField label={S.sessionActions.targetDate} value={date} onChange={setDate} />
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
