import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { newId } from '../../domain/ids';
import { applyMaxChange, cycleMaxIds, previewMaxChange, withUpdatedMaxes } from '../../domain/max';
import type { Cycle, Maxes, MaxId, Session } from '../../domain/types';
import { commit } from '../actions';
import { useApp, useData, useMaxNames, useMaxOf } from '../context';
import { formatKg } from '../format';
import { S } from '../strings';
import { NumberField } from './NumberField';
import { Sheet } from './Sheet';

/** Carte « Mes max » : tap → panneau d'édition avec aperçu des séries planifiées qui changent. */
export function MaxCard({ cycle }: { cycle: Cycle }) {
  const [open, setOpen] = useState(false);
  const { name } = useMaxNames();
  const current = useMaxOf().maxOf(cycle.max);
  const sessions = useData((repo) => repo.listSessionsByCycle(cycle.id), [cycle.id]);
  const ids = cycleMaxIds(cycle, sessions ?? []);
  return (
    <section class="card stack tight">
      <div class="section-header">
        <h3>
          {S.max.title} <span class="muted">· {cycle.name}</span>
        </h3>
      </div>
      <button type="button" class="max-grid max-button" aria-label={S.max.edit} onClick={() => setOpen(true)}>
        {ids.map((id) => (
          <span key={id} class="max-cell">
            <span class="muted">{name(id)}</span>
            <span class="num max-value">{current[id] ? formatKg(current[id]) : '—'}</span>
          </span>
        ))}
        {ids.length === 0 && <span class="muted">{S.max.none}</span>}
      </button>
      {open && sessions && <MaxSheet cycle={cycle} sessions={sessions} ids={ids} onClose={() => setOpen(false)} />}
    </section>
  );
}

interface SheetProps {
  cycle: Cycle;
  sessions: Session[];
  ids: MaxId[];
  onClose: () => void;
}

function MaxSheet({ cycle, sessions, ids, onClose }: SheetProps) {
  const app = useApp();
  // Valeurs de départ : celles du cycle, sinon le RM actuel de l'exercice (qui s'applique déjà).
  const current = useMaxOf().maxOf(cycle.max);
  const [max, setMax] = useState<Maxes>(Object.fromEntries(ids.map((id) => [id, current[id] ?? 0])));
  const changes = previewMaxChange(sessions, current, max, app.settings.rounding);
  const unchanged = ids.every((id) => (max[id] ?? 0) === (cycle.max[id] ?? 0));
  // Exemples distincts : une ligne par exercice et par charge.
  const examples = [...new Map(changes.map((c) => [`${c.exerciseName}|${c.fromKg}|${c.toKg}`, c])).values()].slice(0, 3);

  const save = async () => {
    const { cycle: updated, log } = applyMaxChange(cycle, { ...cycle.max, ...max }, new Date().toISOString(), newId);
    // Le RM saisi devient aussi le RM actuel de l'exercice.
    const saveExercises = withUpdatedMaxes([...app.exercises.values()], max);
    if (await commit(app, { saveCycles: [updated], addMaxChanges: log, saveExercises }, S.max.saved)) onClose();
  };

  return (
    <Sheet title={S.max.sheetTitle(cycle.name)} onClose={onClose}>
      <MaxFields ids={ids} max={max} onChange={setMax} />
      <div class="card stack tight" aria-live="polite">
        <strong>{S.max.preview(changes.length)}</strong>
        {examples.map((c) => (
          <span key={`${c.exerciseName}-${c.fromKg}-${c.toKg}`} class="num">
            {S.max.example(c.exerciseName, formatKg(c.fromKg), formatKg(c.toKg))}
          </span>
        ))}
        <span class="muted">{S.max.doneNote}</span>
      </div>
      <button type="button" class="btn primary" disabled={unchanged || ids.some((id) => !(max[id]! > 0))} onClick={save}>
        {S.max.save}
      </button>
    </Sheet>
  );
}

/** Un champ par RM ; `extra` s'affiche sous chaque champ (boutons +2,5 kg…). */
export function MaxFields({
  ids,
  max,
  onChange,
  extra,
}: {
  ids: readonly MaxId[];
  max: Maxes;
  onChange: (max: Maxes) => void;
  extra?: (id: MaxId, name: string) => ComponentChildren;
}) {
  const { name } = useMaxNames();
  return (
    <>
      {ids.map((id) => (
        <div key={id} class="stack tight">
          <NumberField
            label={name(id)}
            value={max[id] ?? 0}
            step={2.5}
            max={500}
            suffix="kg"
            onChange={(v) => onChange({ ...max, [id]: v })}
          />
          {extra?.(id, name(id))}
        </div>
      ))}
    </>
  );
}
