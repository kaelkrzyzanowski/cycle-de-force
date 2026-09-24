import { useState } from 'preact/hooks';
import { conflictDates, cycleEndDate, duplicateCycle, resolveConflicts } from '../../domain/cycles';
import type { CopyMode } from '../../domain/cycles';
import { addDays } from '../../domain/dates';
import { newId } from '../../domain/ids';
import { LIFTS } from '../../domain/types';
import type { Cycle, Maxes, Session, SessionTemplate } from '../../domain/types';
import { commit, templatesById } from '../actions';
import { allResolved, ConflictResolver } from '../components/ConflictResolver';
import type { Choices } from '../components/ConflictResolver';
import { DateField, RadioList, TextField } from '../components/fields';
import { NumberField } from '../components/NumberField';
import { useApp, useData } from '../context';
import { formatDayLong, formatKg, formatRange } from '../format';
import { href, navigate } from '../router';
import { S } from '../strings';

interface Data {
  cycle: Cycle | undefined;
  sessions: Session[];
  templates: SessionTemplate[];
}

export function DuplicateCycleScreen({ id }: { id: string }) {
  const data = useData<Data>(
    async (repo) => ({
      cycle: await repo.getCycle(id),
      sessions: await repo.listSessionsByCycle(id),
      templates: await repo.listTemplates(),
    }),
    [id],
  );
  if (!data) return <p class="muted">{S.loading}</p>;
  if (!data.cycle) return <p class="card">{S.duplicateCycle.notFound}</p>;
  return <Form source={data.cycle} sessions={data.sessions} templates={data.templates} />;
}

const BUMPS = [2.5, 5];

function Form({ source, sessions, templates }: { source: Cycle; sessions: Session[]; templates: SessionTemplate[] }) {
  const app = useApp();
  const [name, setName] = useState(S.duplicateCycle.defaultName(source.name));
  const [startDate, setStartDate] = useState(addDays(cycleEndDate(source), 1));
  const [max, setMax] = useState<Maxes>({ ...source.max });
  const [mode, setMode] = useState<CopyMode>('TEMPLATE');
  const [choices, setChoices] = useState<Choices>({});

  const result = duplicateCycle(source, sessions, { name: name.trim(), startDate, max, mode }, templatesById(templates), newId);
  const end = cycleEndDate(result.cycle);
  const existing = useData(async (repo) => repo.listSessionsBetween(startDate, end), [startDate, end]) ?? [];
  const conflicts = conflictDates(result.sessions, existing);

  const submit = async () => {
    const { save, remove } = resolveConflicts(result.sessions, existing, choices);
    const ok = await commit(
      app,
      { saveCycles: [result.cycle], saveSessions: save, deleteSessionIds: remove.map((s) => s.id) },
      S.cycleForm.created(result.cycle.name, save.length),
    );
    if (ok) navigate(href.cycle(result.cycle.id), true);
  };

  return (
    <div class="stack">
      <section class="card stack">
        <TextField label={S.duplicateCycle.name} value={name} onChange={setName} />
        <DateField
          label={S.duplicateCycle.startDate}
          value={startDate}
          onChange={(d) => {
            setStartDate(d);
            setChoices({});
          }}
          monday
          hint={`${S.cycleForm.startsOn(formatDayLong(startDate).toLowerCase())} ${formatRange(startDate, end)}`}
        />
      </section>

      <section class="card stack">
        <div class="section-header">
          <h2 class="card-title">{S.duplicateCycle.max}</h2>
          <button type="button" class="btn small" onClick={() => setMax({ ...source.max })}>
            {S.duplicateCycle.reset}
          </button>
        </div>
        {LIFTS.map((lift) => (
          <div key={lift} class="stack tight">
            <NumberField
              label={S.lifts[lift]}
              value={max[lift]}
              step={2.5}
              max={500}
              suffix="kg"
              onChange={(v) => setMax({ ...max, [lift]: v })}
            />
            <div class="button-row start">
              {BUMPS.map((kg) => (
                <button
                  key={kg}
                  type="button"
                  class="btn small"
                  aria-label={`${S.lifts[lift]} ${S.duplicateCycle.bump(formatKg(kg))} kg`}
                  onClick={() => setMax({ ...max, [lift]: source.max[lift] + kg })}
                >
                  {S.duplicateCycle.bump(formatKg(kg))}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section class="card stack">
        <RadioList<CopyMode>
          label={S.copyMode.label}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'TEMPLATE', label: S.duplicateCycle.modeTemplate },
            { value: 'AS_IS', label: S.duplicateCycle.modeAsIs },
          ]}
        />
        <p class="muted">{S.copyMode.note}</p>
        <p>
          <strong>{S.cycleForm.total(result.sessions.length)}</strong>
        </p>
      </section>

      <ConflictResolver dates={conflicts} existing={existing} choices={choices} onChange={setChoices} />

      <div class="button-row sticky-actions">
        <button
          type="button"
          class="btn primary"
          disabled={name.trim() === '' || !allResolved(conflicts, choices)}
          onClick={submit}
        >
          {S.duplicateCycle.submit}
        </button>
      </div>
    </div>
  );
}
