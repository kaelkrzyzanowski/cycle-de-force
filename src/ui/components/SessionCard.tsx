import { deriveSessionStatus } from '../../domain/sessionStatus';
import type { SessionStatus } from '../../domain/sessionStatus';
import { sessionTotals } from '../../domain/totals';
import type { Maxes, Rounding, Session } from '../../domain/types';
import { formatTonnage } from '../format';
import { S } from '../strings';
import { useLongPress } from './useLongPress';

export const STATUS_GLYPH: Record<SessionStatus, string> = {
  PLANNED: '',
  MISSED: '–',
  IN_PROGRESS: '◐',
  FAILED: '✕',
  INCOMPLETE: '!',
  VALIDATED: '✓',
};

export const NEUTRAL_COLOR = '#6b7280';

/** Pastille du calendrier : anneau à la couleur du modèle, fond et icône selon le statut. */
export function SessionDot({ color, status, name }: { color: string; status: SessionStatus; name: string }) {
  return (
    <span class={`dot st-${status}`} style={{ '--tpl': color }} title={`${name} · ${S.sessionStatus[status]}`}>
      {STATUS_GLYPH[status]}
    </span>
  );
}

interface CardProps {
  session: Session;
  color: string;
  max: Maxes;
  rounding: Rounding;
  today: string;
  onOpen: () => void;
  onActions: () => void;
}

export function SessionCard({ session, color, max, rounding, today, onOpen, onActions }: CardProps) {
  const status = deriveSessionStatus(session, today);
  const press = useLongPress(onOpen, onActions);
  const totals = sessionTotals(session, max, rounding);
  const main = session.exercises.slice(0, 3).map((e) => e.name);
  const more = session.exercises.length - main.length;

  return (
    <article class={`session-card st-${status}`} style={{ '--tpl': color }}>
      <button type="button" class="session-card-main" {...press}>
        <span class="session-card-title">
          <span class="session-name">{session.name}</span>
          <span class={`status-pill st-${status}`}>
            {STATUS_GLYPH[status] && <span aria-hidden="true">{STATUS_GLYPH[status]} </span>}
            {S.sessionStatus[status]}
          </span>
        </span>
        <span class="session-exercises muted">
          {main.length === 0 ? S.sessionCard.empty : main.join(' · ') + (more > 0 ? ` +${more}` : '')}
        </span>
        {totals.reps > 0 && (
          <span class="session-tonnage">
            {S.sessionCard.tonnage} <span class="num">{formatTonnage(totals.tonnage)}</span>
          </span>
        )}
      </button>
      <button type="button" class="icon-btn session-more" aria-label={S.sessionCard.actions(session.name)} onClick={onActions}>
        ⋯
      </button>
    </article>
  );
}
