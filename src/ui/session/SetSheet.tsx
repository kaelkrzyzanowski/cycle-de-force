import { useState } from 'preact/hooks';
import { displayKg, displayReps, plannedKg } from '../../domain/load';
import type { Maxes, Rounding, SessionSet } from '../../domain/types';
import { NumberField } from '../components/NumberField';
import { Sheet } from '../components/Sheet';
import { S } from '../strings';
import { SET_GLYPH, setText } from './SetPill';

export type SetDecision =
  | { status: 'VALIDATED' | 'FAILED' | 'CLUSTER'; reps: number; kg: number | null }
  | { status: 'NOT_DONE' }
  | { status: 'PLANNED' };

interface Props {
  set: SessionSet;
  exerciseName: string;
  max: Maxes;
  rounding: Rounding;
  onDecide: (decision: SetDecision) => void;
  onClose: () => void;
}

/** Panneau bas pré-rempli avec le prévu : ajuster reps et charge, puis choisir le statut. */
export function SetSheet({ set, exerciseName, max, rounding, onDecide, onClose }: Props) {
  const planned = plannedKg(set.load, max, rounding);
  const [reps, setReps] = useState(displayReps(set));
  const [kg, setKg] = useState<number>(displayKg(set, max, rounding) ?? 0);
  const hasLoad = set.load.kind !== 'NONE' || kg > 0;
  const actual = { reps, kg: hasLoad ? kg : null };

  return (
    <Sheet title={S.setSheet.title(set.index + 1, exerciseName)} onClose={onClose}>
      <p class="muted num">{S.setSheet.plannedWas(setText(set.plannedReps, planned))}</p>
      <NumberField label={S.setSheet.reps} value={reps} onChange={setReps} min={0} max={100} />
      <NumberField label={S.setSheet.kg} value={kg} onChange={setKg} step={2.5} max={500} suffix="kg" />
      <div class="status-grid">
        <button type="button" class="status-btn st-FAILED" onClick={() => onDecide({ status: 'FAILED', ...actual })}>
          <span aria-hidden="true">{SET_GLYPH.FAILED}</span> {S.setSheet.failed}
        </button>
        <button type="button" class="status-btn st-CLUSTER" onClick={() => onDecide({ status: 'CLUSTER', ...actual })}>
          <span aria-hidden="true">{SET_GLYPH.CLUSTER}</span> {S.setSheet.cluster}
        </button>
        <button type="button" class="status-btn st-NOT_DONE" onClick={() => onDecide({ status: 'NOT_DONE' })}>
          <span aria-hidden="true">{SET_GLYPH.NOT_DONE}</span> {S.setSheet.notDone}
        </button>
        <button type="button" class="status-btn st-VALIDATED" onClick={() => onDecide({ status: 'VALIDATED', ...actual })}>
          <span aria-hidden="true">{SET_GLYPH.VALIDATED}</span> {S.setSheet.validated}
        </button>
      </div>
      {set.status !== 'PLANNED' && (
        <button type="button" class="btn" onClick={() => onDecide({ status: 'PLANNED' })}>
          {S.setSheet.reset}
        </button>
      )}
    </Sheet>
  );
}
