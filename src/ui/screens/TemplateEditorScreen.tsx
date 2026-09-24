import { useState } from 'preact/hooks';
import { todayIso } from '../../domain/dates';
import { newId } from '../../domain/ids';
import { applyEdit } from '../../domain/sessionEdit';
import type { SessionEdit } from '../../domain/sessionEdit';
import {
  applyProgression,
  copyWeek,
  duplicateTemplate,
  progressionValues,
  refreshFromTemplate,
  sessionAsWeek,
  setWeeksCount,
  TEMPLATE_COLORS,
  untouchedFutureSessions,
  weekAsSession,
} from '../../domain/templates';
import { LIFTS } from '../../domain/types';
import type { Exercise, Lift, Session, SessionTemplate } from '../../domain/types';
import { nativeTemplates } from '../../seed';
import { TextField } from '../components/fields';
import { NumberField } from '../components/NumberField';
import { Sheet } from '../components/Sheet';
import { useApp, useData } from '../context';
import { formatKg } from '../format';
import { href, navigate } from '../router';
import { S } from '../strings';
import { PrescriptionEditor, useCatalogue } from '../session/EditSession';

const FAR_FUTURE = '9999-12-31';

export function TemplateEditorScreen({ id }: { id: string }) {
  const data = useData(async (repo) => ({ template: await repo.getTemplate(id), catalogue: await repo.listExercises() }), [id]);
  if (!data) return <p class="muted">{S.loading}</p>;
  if (!data.template) return <p class="card">{S.templateEditor.notFound}</p>;
  return <Editor key={id} saved={data.template} catalogue={data.catalogue} />;
}

type Dialog = 'copy' | 'progression' | 'more' | 'reset' | 'delete' | { future: Session[] } | null;

function Editor({ saved, catalogue }: { saved: SessionTemplate; catalogue: Exercise[] }) {
  const app = useApp();
  const [template, setTemplate] = useState(saved);
  const [week, setWeek] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const { known, resolve, newExercises } = useCatalogue(catalogue);

  const change = (next: SessionTemplate) => {
    setTemplate(next);
    setDirty(true);
  };
  const draft = weekAsSession(template, week);
  const dispatch = (edit: SessionEdit) => {
    const next = applyEdit(draft, edit, newId);
    if (next) change({ ...template, weeks: { ...template.weeks, [week]: sessionAsWeek(next) } });
  };

  const persist = async (t: SessionTemplate) => {
    const used = new Set(Object.values(t.weeks).flatMap((w) => w.map((e) => e.exerciseId)));
    await Promise.all(newExercises.filter((e) => used.has(e.id)).map((e) => app.repo.saveExercise(e)));
    await app.repo.saveTemplate(t);
  };

  const save = async () => {
    await persist(template);
    setDirty(false);
    const untouched = untouchedFutureSessions(template, await app.repo.listSessionsBetween(todayIso(), FAR_FUTURE), todayIso());
    const future = refreshFromTemplate(template, untouched, newId);
    if (future.length > 0) setDialog({ future });
    else {
      app.refresh();
      app.toast(S.templateEditor.saved);
    }
  };

  const updateFuture = async (future: Session[]) => {
    await app.repo.applyChanges({ saveSessions: future });
    setDialog(null);
    app.refresh();
    app.toast(S.templateEditor.updated(future.length));
  };

  const duplicate = async () => {
    const copy = duplicateTemplate(template, S.templateEditor.duplicateName(template.name), newId);
    await persist(copy);
    app.refresh();
    app.toast(S.templates.created(copy.name));
    navigate(href.template(copy.id));
  };

  const remove = async () => {
    await app.repo.deleteTemplate(template.id);
    app.refresh();
    app.toast(S.templateEditor.deleted);
    navigate(href.templates(), true);
  };

  const weeks = Array.from({ length: template.weeksCount }, (_, i) => i + 1);

  return (
    <div class="stack">
      <section class="card stack">
        <TextField label={S.templateEditor.name} value={template.name} onChange={(name) => change({ ...template, name })} />
        <div class="field">
          <span id="tpl-color">{S.templateEditor.color}</span>
          <div class="color-row" role="radiogroup" aria-labelledby="tpl-color">
            {TEMPLATE_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                role="radio"
                class="color-swatch"
                style={{ background: c }}
                aria-checked={template.color === c}
                aria-label={S.templateEditor.colorN(i + 1)}
                onClick={() => change({ ...template, color: c })}
              />
            ))}
          </div>
        </div>
        <NumberField
          label={S.templateEditor.weeks}
          value={template.weeksCount}
          min={1}
          max={16}
          onChange={(n) => {
            change(setWeeksCount(template, n));
            setWeek(Math.min(week, n));
          }}
        />
      </section>

      <div class="segmented scroll week-tabs" role="tablist" aria-label={S.templateEditor.weekTabs}>
        {weeks.map((w) => (
          <button key={w} type="button" role="tab" class="num" aria-selected={w === week} aria-pressed={w === week} onClick={() => setWeek(w)}>
            {S.templateEditor.weekTab(w)}
          </button>
        ))}
      </div>

      <div class="button-row start">
        <button type="button" class="btn small" onClick={() => setDialog('copy')}>
          ⧉ {S.templateEditor.copyWeek(week)}
        </button>
        <button type="button" class="btn small" onClick={() => setDialog('progression')}>
          ↗ {S.templateEditor.progression}
        </button>
      </div>

      <div role="tabpanel" class="stack" aria-label={S.templateEditor.weekTab(week)}>
        <PrescriptionEditor key={week} draft={draft} known={known} dispatch={dispatch} resolve={resolve} />
      </div>

      <div class="button-row sticky-actions">
        <button type="button" class="btn" aria-label={S.templateEditor.more} onClick={() => setDialog('more')}>
          ⋯
        </button>
        {dirty && (
          <button
            type="button"
            class="btn"
            onClick={() => {
              setTemplate(saved);
              setDirty(false);
            }}
          >
            {S.templateEditor.discard}
          </button>
        )}
        <button type="button" class="btn primary" disabled={!dirty || template.name.trim() === ''} onClick={() => void save()}>
          {S.templateEditor.save}
        </button>
      </div>

      {dialog === 'copy' && (
        <CopyWeekSheet
          template={template}
          from={week}
          onApply={(targets) => {
            change(copyWeek(template, week, targets));
            setDialog(null);
            app.toast(S.templateEditor.copied(week, targets.length));
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'progression' && (
        <ProgressionSheet
          template={template}
          known={known}
          onApply={(next, skipped) => {
            change(next);
            setDialog(null);
            app.toast(skipped.length ? S.templateEditor.progSkipped(skipped.map((w) => `S${w}`).join(', ')) : S.templateEditor.progApplied);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'more' && (
        <Sheet title={S.templateEditor.more} onClose={() => setDialog(null)}>
          <div class="choice-list">
            <button type="button" class="choice" onClick={() => void duplicate()}>
              {S.templateEditor.duplicate}
            </button>
            {template.native ? (
              <button type="button" class="choice" onClick={() => setDialog('reset')}>
                {S.templateEditor.reset}
              </button>
            ) : (
              <button type="button" class="choice danger" onClick={() => setDialog('delete')}>
                {S.templateEditor.delete}
              </button>
            )}
          </div>
        </Sheet>
      )}
      {(dialog === 'reset' || dialog === 'delete') && (
        <Sheet title={dialog === 'reset' ? S.templateEditor.reset : S.templateEditor.delete} onClose={() => setDialog(null)}>
          <p>{dialog === 'reset' ? S.templateEditor.resetConfirm : S.templateEditor.deleteConfirm}</p>
          <div class="button-row">
            <button type="button" class="btn" onClick={() => setDialog(null)}>
              {S.common.cancel}
            </button>
            <button
              type="button"
              class="btn danger"
              onClick={() => {
                if (dialog === 'delete') {
                  void remove();
                  return;
                }
                const original = nativeTemplates().find((t) => t.id === template.id);
                if (original) {
                  change(original);
                  setWeek(1);
                  app.toast(S.templateEditor.resetDone);
                }
                setDialog(null);
              }}
            >
              {S.templateEditor.confirm}
            </button>
          </div>
        </Sheet>
      )}
      {dialog !== null && typeof dialog === 'object' && (
        <Sheet
          title={S.templateEditor.updateFutureTitle}
          onClose={() => {
            setDialog(null);
            app.refresh();
          }}
        >
          <p>{S.templateEditor.updateFutureText(dialog.future.length)}</p>
          <div class="choice-list">
            <button type="button" class="choice" onClick={() => void updateFuture(dialog.future)}>
              {S.templateEditor.updateYes}
            </button>
            <button
              type="button"
              class="choice"
              onClick={() => {
                setDialog(null);
                app.refresh();
                app.toast(S.templateEditor.saved);
              }}
            >
              {S.templateEditor.updateNo}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function WeekChecks({
  label,
  weeks,
  selected,
  onChange,
}: {
  label: string;
  weeks: number[];
  selected: number[];
  onChange: (weeks: number[]) => void;
}) {
  const all = weeks.every((w) => selected.includes(w));
  return (
    <fieldset class="week-checks">
      <legend>{label}</legend>
      <label>
        <input type="checkbox" checked={all} onChange={() => onChange(all ? [] : weeks)} />
        {S.templateEditor.all}
      </label>
      {weeks.map((w) => (
        <label key={w}>
          <input
            type="checkbox"
            checked={selected.includes(w)}
            onChange={() => onChange(selected.includes(w) ? selected.filter((x) => x !== w) : [...selected, w].sort((a, b) => a - b))}
          />
          S{w}
        </label>
      ))}
    </fieldset>
  );
}

function CopyWeekSheet({
  template,
  from,
  onApply,
  onClose,
}: {
  template: SessionTemplate;
  from: number;
  onApply: (targets: number[]) => void;
  onClose: () => void;
}) {
  const others = Array.from({ length: template.weeksCount }, (_, i) => i + 1).filter((w) => w !== from);
  const [targets, setTargets] = useState<number[]>([]);
  return (
    <Sheet title={S.templateEditor.copyWeek(from)} onClose={onClose}>
      <WeekChecks label={S.templateEditor.copyTargets} weeks={others} selected={targets} onChange={setTargets} />
      <button type="button" class="btn primary" disabled={targets.length === 0} onClick={() => onApply(targets)}>
        {S.templateEditor.copyApply}
      </button>
    </Sheet>
  );
}

function ProgressionSheet({
  template,
  known,
  onApply,
  onClose,
}: {
  template: SessionTemplate;
  known: readonly Exercise[];
  onApply: (next: SessionTemplate, skipped: number[]) => void;
  onClose: () => void;
}) {
  const exercises = [
    ...new Map(Object.values(template.weeks).flatMap((w) => w.map((e) => [e.exerciseId, e] as const))).values(),
  ];
  const first = exercises[0];
  const [exerciseId, setExerciseId] = useState(first?.exerciseId ?? '');
  const weeksWith = (id: string) =>
    Object.entries(template.weeks)
      .filter(([, list]) => list.some((e) => e.exerciseId === id))
      .map(([w]) => Number(w))
      .sort((a, b) => a - b);
  const liftOf = (id: string): Lift => {
    for (const w of Object.values(template.weeks))
      for (const e of w) if (e.exerciseId === id) for (const s of e.sets) if (s.load.kind === 'PERCENT') return s.load.lift;
    return known.find((k) => k.id === id)?.defaultLift ?? 'B';
  };
  const [lift, setLift] = useState<Lift>(liftOf(exerciseId));
  const [from, setFrom] = useState(65);
  const [to, setTo] = useState(85);
  const [step, setStep] = useState(5);
  const [weeks, setWeeks] = useState<number[]>(weeksWith(exerciseId));

  if (!first) {
    return (
      <Sheet title={S.templateEditor.progression} onClose={onClose}>
        <p>{S.templateEditor.noExercises}</p>
      </Sheet>
    );
  }

  const params = { from: from / 100, to: to / 100, step: step / 100, weeks };
  const preview = progressionValues(params);
  const all = Array.from({ length: template.weeksCount }, (_, i) => i + 1);

  return (
    <Sheet title={S.templateEditor.progression} onClose={onClose}>
      <label class="field">
        <span>{S.templateEditor.progExercise}</span>
        <select
          class="text-input"
          value={exerciseId}
          onChange={(e) => {
            const id = e.currentTarget.value;
            setExerciseId(id);
            setLift(liftOf(id));
            setWeeks(weeksWith(id));
          }}
        >
          {exercises.map((e) => (
            <option key={e.exerciseId} value={e.exerciseId}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <div class="field">
        <span id="prog-lift">{S.templateEditor.progLift}</span>
        <div class="segmented" role="group" aria-labelledby="prog-lift">
          {LIFTS.map((l) => (
            <button key={l} type="button" aria-pressed={lift === l} onClick={() => setLift(l)}>
              {S.lifts[l]}
            </button>
          ))}
        </div>
      </div>
      <NumberField label={S.templateEditor.progFrom} value={from} onChange={setFrom} min={1} max={120} step={5} />
      <NumberField label={S.templateEditor.progTo} value={to} onChange={setTo} min={1} max={120} step={5} />
      <NumberField label={S.templateEditor.progStep} value={step} onChange={setStep} min={0.5} max={50} step={0.5} />
      <WeekChecks label={S.templateEditor.progWeeks} weeks={all} selected={weeks} onChange={setWeeks} />
      <p class="num" aria-live="polite">
        {preview.map((v) => `S${v.week} ${formatKg(Math.round(v.pct * 1000) / 10)} %`).join(' · ')}
      </p>
      <p class="muted">{S.templateEditor.progNote}</p>
      <button
        type="button"
        class="btn primary"
        disabled={weeks.length === 0}
        onClick={() => {
          const { template: next, skipped } = applyProgression(template, { exerciseId, lift, ...params });
          onApply(next, skipped);
        }}
      >
        {S.templateEditor.progApply}
      </button>
    </Sheet>
  );
}
