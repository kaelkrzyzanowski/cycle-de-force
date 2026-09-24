import { useEffect, useMemo, useState } from 'preact/hooks';
import { conflictDates, cycleEndDate, generateCycleSessions, resolveConflicts } from '../../domain/cycles';
import { addDays, isoWeekday, mondayOf, todayIso } from '../../domain/dates';
import { newId } from '../../domain/ids';
import { LIFTS } from '../../domain/types';
import type { Cycle, Maxes, Session, SessionTemplate, Weekday } from '../../domain/types';
import { DEFAULT_MAX, DEFAULT_WEEKLY_PLAN } from '../../seed';
import { commit, templatesById } from '../actions';
import { allResolved, ConflictResolver } from '../components/ConflictResolver';
import type { Choices } from '../components/ConflictResolver';
import { DateField, TextField } from '../components/fields';
import { NumberField } from '../components/NumberField';
import { useApp, useData } from '../context';
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
  const [max, setMax] = useState<Maxes>(previous ? { ...previous.max } : { ...DEFAULT_MAX });
  const [plan, setPlan] = useState<Partial<Record<Weekday, string>>>(
    Object.fromEntries(DEFAULT_WEEKLY_PLAN.map((e) => [e.weekday, e.templateId])),
  );
  const [existing, setExisting] = useState<Session[]>([]);
  const [choices, setChoices] = useState<Choices>({});

  const byId = templatesById(templates);
  const cycle: Cycle = useMemo(
    () => ({
      id: newId(),
      name: name.trim(),
      startDate,
      weeksCount,
      max,
      weeklyPlan: WEEKDAYS.flatMap((weekday) => {
        const templateId = plan[weekday];
        return templateId ? [{ weekday, templateId }] : [];
      }),
    }),
    [name, startDate, weeksCount, max, plan],
  );
  const sessions = useMemo(() => generateCycleSessions(cycle, byId, newId), [cycle, templates]);
  const conflicts = conflictDates(sessions, existing);

  useEffect(() => {
    app.repo.listSessionsBetween(cycle.startDate, cycleEndDate(cycle)).then(setExisting);
  }, [cycle.startDate, cycle.weeksCount]);

  const valid = cycle.name !== '' && LIFTS.every((l) => max[l] > 0);
  const steps = S.cycleForm.steps;

  const create = async () => {
    const { save, remove } = resolveConflicts(sessions, existing, choices);
    const ok = await commit(
      app,
      { saveCycles: [cycle], saveSessions: save, deleteSessionIds: remove.map((s) => s.id) },
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

      {step === 1 && (
        <section class="card stack">
          <h2 class="card-title">{S.cycleForm.max}</h2>
          <p class="muted">{S.cycleForm.maxHint}</p>
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
        </section>
      )}

      {step === 2 && (
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
                    <div>{inWeek.map((s) => `${S.weekdays[isoWeekday(s.date) - 1]?.slice(0, 3)} ${s.name}`).join(' · ')}</div>
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
