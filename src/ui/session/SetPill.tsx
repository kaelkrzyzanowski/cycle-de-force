import { differsFromPlan, displayKg, displayReps, plannedKg } from '../../domain/load';
import type { Maxes, Rounding, SessionSet, SetStatus } from '../../domain/types';
import { useLongPress } from '../components/useLongPress';
import { formatKg, formatRule } from '../format';
import { S } from '../strings';

export const SET_GLYPH: Record<SetStatus, string> = {
  PLANNED: '',
  VALIDATED: '✓',
  FAILED: '✕',
  NOT_DONE: '⊘',
  CLUSTER: 'C',
};

export function setText(reps: number, kg: number | null): string {
  return `${reps} × ${kg === null ? S.session.toEnter : `${formatKg(kg)} kg`}`;
}

interface Props {
  set: SessionSet;
  max: Maxes;
  rounding: Rounding;
  onTap: () => void;
  onLongPress: () => void;
}

/** Tap = valider (ou remettre à prévu), appui long = panneau des autres statuts. */
export function SetPill({ set, max, rounding, onTap, onLongPress }: Props) {
  const press = useLongPress(onTap, onLongPress);
  const text = setText(displayReps(set), displayKg(set, max, rounding));
  const rule = formatRule(set.load);
  const changed = differsFromPlan(set, max, rounding);

  return (
    <button
      type="button"
      class={`set-pill st-${set.status}`}
      aria-label={S.session.setLabel(set.index + 1, text, rule, S.setStatus[set.status])}
      {...press}
    >
      <span class="set-top">
        <span class="set-index">S{set.index + 1}</span>
        {SET_GLYPH[set.status] && (
          <span class="set-glyph" aria-hidden="true">
            {SET_GLYPH[set.status]}
          </span>
        )}
      </span>
      <span class="set-main num">{set.status === 'NOT_DONE' ? <s>{text}</s> : text}</span>
      {changed && <s class="set-planned num">{setText(set.plannedReps, plannedKg(set.load, max, rounding))}</s>}
      {rule && <span class="set-rule">{rule}</span>}
    </button>
  );
}
