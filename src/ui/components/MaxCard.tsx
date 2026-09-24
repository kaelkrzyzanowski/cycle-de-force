import { useState } from 'preact/hooks';
import { newId } from '../../domain/ids';
import { applyMaxChange, previewMaxChange } from '../../domain/max';
import { LIFTS } from '../../domain/types';
import type { Cycle, Maxes } from '../../domain/types';
import { commit } from '../actions';
import { useApp, useData } from '../context';
import { formatKg } from '../format';
import { S } from '../strings';
import { NumberField } from './NumberField';
import { Sheet } from './Sheet';

/** Carte « Mes max » : tap → panneau d'édition avec aperçu des séries planifiées qui changent. */
export function MaxCard({ cycle }: { cycle: Cycle }) {
  const [open, setOpen] = useState(false);
  return (
    <section class="card stack tight">
      <div class="section-header">
        <h3>
          {S.max.title} <span class="muted">· {cycle.name}</span>
        </h3>
      </div>
      <button type="button" class="max-grid max-button" aria-label={S.max.edit} onClick={() => setOpen(true)}>
        {LIFTS.map((lift) => (
          <span key={lift} class="max-cell">
            <span class="muted">{S.lifts[lift]}</span>
            <span class="num max-value">{formatKg(cycle.max[lift])}</span>
          </span>
        ))}
      </button>
      {open && <MaxSheet cycle={cycle} onClose={() => setOpen(false)} />}
    </section>
  );
}

function MaxSheet({ cycle, onClose }: { cycle: Cycle; onClose: () => void }) {
  const app = useApp();
  const [max, setMax] = useState<Maxes>({ ...cycle.max });
  const sessions = useData((repo) => repo.listSessionsByCycle(cycle.id), [cycle.id]) ?? [];
  const changes = previewMaxChange(sessions, cycle.max, max, app.settings.rounding);
  const unchanged = LIFTS.every((l) => max[l] === cycle.max[l]);
  // Exemples distincts : une ligne par exercice et par charge.
  const examples = [...new Map(changes.map((c) => [`${c.exerciseName}|${c.fromKg}|${c.toKg}`, c])).values()].slice(0, 3);

  const save = async () => {
    const { cycle: updated, log } = applyMaxChange(cycle, max, new Date().toISOString(), newId);
    if (await commit(app, { saveCycles: [updated], addMaxChanges: log }, S.max.saved)) onClose();
  };

  return (
    <Sheet title={S.max.sheetTitle(cycle.name)} onClose={onClose}>
      {LIFTS.map((lift) => (
        <NumberField
          key={lift}
          label={S.lifts[lift]}
          value={max[lift]}
          step={2.5}
          max={500}
          suffix="kg"
          onChange={(v) => setMax({ ...max, [lift]: v })}
        />
      ))}
      <div class="card stack tight" aria-live="polite">
        <strong>{S.max.preview(changes.length)}</strong>
        {examples.map((c) => (
          <span key={`${c.exerciseName}-${c.fromKg}-${c.toKg}`} class="num">
            {S.max.example(c.exerciseName, formatKg(c.fromKg), formatKg(c.toKg))}
          </span>
        ))}
        <span class="muted">{S.max.doneNote}</span>
      </div>
      <button type="button" class="btn primary" disabled={unchanged || LIFTS.some((l) => max[l] <= 0)} onClick={save}>
        {S.max.save}
      </button>
    </Sheet>
  );
}
