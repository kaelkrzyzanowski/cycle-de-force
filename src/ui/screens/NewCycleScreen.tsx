import { useEffect, useMemo, useState } from 'preact/hooks';
import { conflictDates, cycleEndDate, generateCycleSessions, resolveConflicts } from '../../domain/cycles';
import { addDays, isoWeekday, mondayOf, todayIso } from '../../domain/dates';
import { newId } from '../../domain/ids';
import { maxIdsUsedBy, templateWeeks, withUpdatedMaxes } from '../../domain/max';
import { sessionLabel } from '../../domain/templates';
import type { Cycle, Maxes, Session, SessionTemplate, Weekday } from '../../domain/types';
import { commit, templatesById } from '../actions';
import { allResolved, ConflictResolver } from '../components/ConflictResolver';
import type { Choices } from '../components/ConflictResolver';
import { DateField, TextField } from '../components/fields';
import { MaxFields } from '../components/MaxCard';
import { NumberField } from '../components/NumberField';
import { useApp, useData, useMaxOf } from '../context';
import { formatDayLong, formatRange } from '../format';
import { href, navigate } from '../router';
import { S } from '../strings';

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

interface Setup {
  cycles: Cycle[];
  templates: SessionTemplate[];
}

export function NewCycleScreen() {
  const setup = useData<Setup>(async (repo) => ({ cycles: await repo.listCycles(), templates: await repo.listTemplates() }), []);
  if (!setup) return <p class="muted">{S.loading}</p>;
  return <Wizard {...setup} />;
}

function Wizard({ cycles, templates }: Setup) {
  const app = useApp();
  const previous = cycles.at(-1);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(S.cycleForm.defaultName(cycles.length));
  const [startDate, setStartDate] = useState(
    previous && cycleEndDate(previous) >= todayIso() ? addDays(cycleEndDate(previous), 1) : mondayOf(todayIso()),
  );
  const [weeksCount, setWeeksCount] = useState(7);
  // RM : ceux renseignés sur les exercices, sinon ceux du cycle précédent. Planning repris du précédent.
  const { fallback } = useMaxOf();
  const [max, setMax] = useState<Maxes>({ ...previous?.max, ...fallback });
  const [plan, setPlan] = useState<Partial<Record<Weekday, string>>>(
    Object.fromEntries(
      (previous?.weeklyPlan ?? []).filter((e) => templates.some((t) => t.id === e.templateId)).map((e) => [e.weekday, e.templateId]),
    ),
  );
  const [existing, setExisting] = useState<Session[]>([]);
  const [choices, setChoices] = useState<Choices>({});

  const byId = templatesById(templates);
  const planned = [...new Set(Object.values(plan))].flatMap((id) => {
    const t = id ? byId.get(id) : undefined;
    return t ? [t] : [];
  });
  // Seuls les RM utilisés par les modèles du planning sont demandés (et gardés dans le cycle).
  const maxIds = maxIdsUsedBy(templateWeeks(planned));
  const cycleMax: Maxes = Object.fromEntries(maxIds.map((id) => [id, max[id] ?? 0]));
  const maxKey = JSON.stringify(cycleMax);
  const cycle: Cycle = useMemo(
    () => ({
      id: newId(),
      name: name.trim(),
      startDate,
      weeksCount,
      max: cycleMax,
      weeklyPlan: WEEKDAYS.flatMap((weekday) => {
        const templateId = plan[weekday];
        return templateId ? [{ weekday, templateId }] : [];
      }),
    }),
    [name, startDate, weeksCount, maxKey, plan],
  );
  const sessions = useMemo(() => generateCycleSessions(cycle, byId, newId), [cycle, templates]);
  const conflicts = conflictDates(sessions, existing);

  useEffect(() => {
    app.repo.listSessionsBetween(cycle.startDate, cycleEndDate(cycle)).then(setExisting);
  }, [cycle.startDate, cycle.weeksCount]);

  const maxValid = maxIds.every((id) => (cycleMax[id] ?? 0) > 0);
  // Étapes : 0 Cycle, 1 Planning, 2 Max, 3 Aperçu.
  const valid = cycle.name !== '' && (step < 2 || maxValid);
  const steps = S.cycleForm.steps;

  const create = async () => {
    const { save, remove } = resolveConflicts(sessions, existing, choices);
    const ok = await commit(
      app,
      {
        saveCycles: [cycle],
        saveSessions: save,
        deleteSessionIds: remove.map((s) => s.id),
        saveExercises: withUpdatedMaxes([...app.exercises.values()], cycle.max),
      },
      S.cycleForm.created(cycle.name, save.length),
    );
    if (ok) navigate(href.calendar(), true);
  };

  return (
    <div class="stack wizard">
      <p class="muted">{S.cycleForm.stepOf(step + 1, steps.length, steps[step] ?? '')}</p>

      {step === 0 && (
        <section class="card stack">
          <TextField label={S.cycleForm.name} value={name} onChange={setName} />
          <DateField
            label={S.cycleForm.startDate}
            value={startDate}
            onChange={setStartDate}
            monday
            hint={S.cycleForm.startsOn(formatDayLong(startDate).toLowerCase())}
          />
          <NumberField label={S.cycleForm.weeks} value={weeksCount} onChange={setWeeksCount} min={1} max={16} />
        </section>
      )}

      {step === 2 && (
        <section class="card stack">
          <h2 class="card-title">{S.cycleForm.max}</h2>
          <p class="muted">{maxIds.length > 0 ? S.cycleForm.maxHint : S.cycleForm.noMax}</p>
          <MaxFields ids={maxIds} max={max} onChange={setMax} />
        </section>
      )}

      {step === 1 && (
        <section class="card stack">
          <h2 class="card-title">{S.cycleForm.planning}</h2>
          {WEEKDAYS.map((weekday) => (
            <label key={weekday} class="plan-row">
              <span>{S.weekdays[weekday - 1]}</span>
              <select
                class="text-input"
                value={plan[weekday] ?? ''}
                onChange={(e) => setPlan({ ...plan, [weekday]: e.currentTarget.value || undefined })}
              >
                <option value="">{S.cycleForm.noTemplate}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>
      )}

      {step === 3 && (
        <>
          <section class="card stack">
            <h2 class="card-title">{cycle.name}</h2>
            <p class="muted">{formatRange(cycle.startDate, cycleEndDate(cycle))}</p>
            <ol class="preview-weeks">
              {Array.from({ length: weeksCount }, (_, i) => {
                const monday = addDays(startDate, i * 7);
                const inWeek = sessions.filter((s) => s.cycleWeek === i + 1);
                return (
                  <li key={i}>
                    <strong class="num">{S.cycleForm.weekLabel(i + 1)}</strong>{' '}
                    <span class="muted">{formatRange(monday, addDays(monday, 6))}</span>
                    <div>{inWeek.map((s) => `${S.weekdays[isoWeekday(s.date) - 1]?.slice(0, 3)} ${sessionLabel(s, byId.get(s.templateId ?? ''))}`).join(' · ')}</div>
                  </li>
                );
              })}
            </ol>
            <p>
              <strong>{S.cycleForm.total(sessions.length)}</strong>
            </p>
          </section>
          <ConflictResolver dates={conflicts} existing={existing} choices={choices} onChange={setChoices} />
        </>
      )}

      {!valid && <p class="warning">{S.cycleForm.invalid}</p>}

      <div class="button-row sticky-actions">
        {step > 0 && (
          <button type="button" class="btn" onClick={() => setStep(step - 1)}>
            {S.common.previous}
          </button>
        )}
        {step < steps.length - 1 ? (
          <button type="button" class="btn primary" disabled={!valid} onClick={() => setStep(step + 1)}>
            {S.common.next}
          </button>
        ) : (
          <button
            type="button"
            class="btn primary"
            disabled={!valid || sessions.length === 0 || !allResolved(conflicts, choices)}
            onClick={create}
          >
            {S.common.create}
          </button>
        )}
      </div>
    </div>
  );
}
