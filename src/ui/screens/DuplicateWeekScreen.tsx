import { useState } from 'preact/hooks';
import { conflictDates, cycleWeekOf, duplicateWeek, findCycleForDate, resolveConflicts } from '../../domain/cycles';
import type { CopyMode } from '../../domain/cycles';
import { addDays, mondayOf, todayIso } from '../../domain/dates';
import { newId } from '../../domain/ids';
import { sessionLabel } from '../../domain/templates';
import type { Cycle, IsoDate, Session, SessionTemplate } from '../../domain/types';
import { commit, templatesById } from '../actions';
import { allResolved, ConflictResolver } from '../components/ConflictResolver';
import type { Choices } from '../components/ConflictResolver';
import { DateField, RadioList } from '../components/fields';
import { useApp, useData } from '../context';
import { formatRange } from '../format';
import { href, navigate } from '../router';
import { S } from '../strings';

interface Data {
  cycles: Cycle[];
  templates: SessionTemplate[];
  source: Session[];
  target: Session[];
}

function weekLabel(monday: IsoDate, cycles: readonly Cycle[]): string {
  const cycle = findCycleForDate(cycles, monday);
  const week = cycle ? cycleWeekOf(cycle, monday) : null;
  const range = S.duplicateWeek.weekOf(formatRange(monday, addDays(monday, 6)));
  return `${range} · ${cycle && week ? S.duplicateWeek.cycleWeek(cycle.name, week) : S.duplicateWeek.outOfCycle}`;
}

export function DuplicateWeekScreen({ from }: { from: IsoDate | null }) {
  const app = useApp();
  const [sourceMonday, setSource] = useState(mondayOf(from ?? todayIso()));
  const [targetMonday, setTarget] = useState(addDays(mondayOf(from ?? todayIso()), 7));
  const [mode, setMode] = useState<CopyMode>('AS_IS');
  const [templateWeek, setTemplateWeek] = useState<number | null>(null);
  const [choices, setChoices] = useState<Choices>({});

  const data = useData<Data>(
    async (repo) => ({
      cycles: await repo.listCycles(),
      templates: await repo.listTemplates(),
      source: await repo.listSessionsBetween(sourceMonday, addDays(sourceMonday, 6)),
      target: await repo.listSessionsBetween(targetMonday, addDays(targetMonday, 6)),
    }),
    [sourceMonday, targetMonday],
  );
  if (!data) return <p class="muted">{S.loading}</p>;

  const targetCycle = findCycleForDate(data.cycles, targetMonday);
  const defaultWeek =
    (targetCycle ? cycleWeekOf(targetCycle, targetMonday) : null) ?? data.source.find((s) => s.cycleWeek)?.cycleWeek ?? 1;
  const k = templateWeek ?? defaultWeek;
  const maxWeeks = Math.max(1, ...data.templates.map((t) => t.weeksCount));

  const copies = duplicateWeek(
    {
      sessions: data.source,
      sourceMonday,
      targetMonday,
      mode,
      templateWeek: k,
      templates: templatesById(data.templates),
      cycles: data.cycles,
    },
    newId,
  );
  const conflicts = conflictDates(copies, data.target);
  const sameWeek = sourceMonday === targetMonday;

  const submit = async () => {
    const { save, remove } = resolveConflicts(copies, data.target, choices);
    const ok = await commit(
      app,
      { saveSessions: save, deleteSessionIds: remove.map((s) => s.id) },
      S.duplicateWeek.done(save.length),
    );
    if (ok) navigate(href.calendar(), true);
  };

  return (
    <div class="stack">
      <section class="card stack">
        <DateField
          label={S.duplicateWeek.source}
          value={sourceMonday}
          onChange={(d) => {
            setSource(d);
            setChoices({});
          }}
          monday
          hint={weekLabel(sourceMonday, data.cycles)}
        />
        {data.source.length === 0 ? (
          <p class="warning">{S.duplicateWeek.none}</p>
        ) : (
          <p>
            <strong>{S.duplicateWeek.found(data.source.length)}</strong> :{' '}
            {data.source.map((s) => sessionLabel(s, data.templates.find((t) => t.id === s.templateId))).join(' · ')}
          </p>
        )}
      </section>

      <section class="card stack">
        <DateField
          label={S.duplicateWeek.target}
          value={targetMonday}
          onChange={(d) => {
            setTarget(d);
            setChoices({});
          }}
          monday
          hint={weekLabel(targetMonday, data.cycles)}
        />
        {sameWeek && <p class="warning">{S.duplicateWeek.sameWeek}</p>}
      </section>

      <section class="card stack">
        <RadioList<CopyMode>
          label={S.copyMode.label}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'AS_IS', label: S.copyMode.asIs },
            {
              value: 'TEMPLATE',
              label: S.copyMode.template,
              children: (
                <div class="segmented scroll" role="group" aria-label={S.copyMode.templateWeek}>
                  {Array.from({ length: maxWeeks }, (_, i) => i + 1).map((w) => (
                    <button key={w} type="button" class="num" aria-pressed={k === w} onClick={() => setTemplateWeek(w)}>
                      {S.common.week(w)}
                    </button>
                  ))}
                </div>
              ),
            },
          ]}
        />
        <p class="muted">{S.copyMode.note}</p>
      </section>

      <ConflictResolver dates={conflicts} existing={data.target} choices={choices} onChange={setChoices} />

      <div class="button-row sticky-actions">
        <button
          type="button"
          class="btn primary"
          disabled={copies.length === 0 || sameWeek || !allResolved(conflicts, choices)}
          onClick={submit}
        >
          {S.duplicateWeek.submit}
        </button>
      </div>
    </div>
  );
}
