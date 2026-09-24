import { cycleEndDate, cycleWeekOf } from '../../domain/cycles';
import { addDays, todayIso } from '../../domain/dates';
import { deriveSessionStatus } from '../../domain/sessionStatus';
import { sessionLabel } from '../../domain/templates';
import { sessionTotals } from '../../domain/totals';
import type { Cycle, MaxChange, Session, SessionTemplate } from '../../domain/types';
import { templatesById } from '../actions';
import { MaxCard } from '../components/MaxCard';
import { NEUTRAL_COLOR, SessionDot } from '../components/SessionCard';
import { useApp, useData } from '../context';
import { formatDayLong, formatDayShort, formatKg, formatRange, formatTonnage } from '../format';
import { href } from '../router';
import { S } from '../strings';

interface Data {
  cycle: Cycle | undefined;
  sessions: Session[];
  templates: SessionTemplate[];
  maxChanges: MaxChange[];
}

export function CycleScreen({ id }: { id: string }) {
  const { settings } = useApp();
  const data = useData<Data>(
    async (repo) => ({
      cycle: await repo.getCycle(id),
      sessions: await repo.listSessionsByCycle(id),
      templates: await repo.listTemplates(),
      maxChanges: await repo.listMaxChanges(id),
    }),
    [id],
  );
  if (!data) return <p class="muted">{S.loading}</p>;
  const { cycle, sessions } = data;
  if (!cycle) return <p class="card">{S.cycle.notFound}</p>;

  const today = todayIso();
  const templates = templatesById(data.templates);
  const currentWeek = cycleWeekOf(cycle, today);
  const colorOf = (s: Session) => (s.templateId ? templates.get(s.templateId)?.color : undefined) ?? NEUTRAL_COLOR;

  return (
    <div class="stack">
      <section class="card stack">
        <h2>{cycle.name}</h2>
        <p class="muted">
          {S.cycle.dates(formatDayLong(cycle.startDate).toLowerCase(), formatDayLong(cycleEndDate(cycle)).toLowerCase())}
        </p>
        {currentWeek && <p>{S.cycle.currentWeek(currentWeek, cycle.weeksCount)}</p>}
      </section>

      <MaxCard cycle={cycle} />
      {data.maxChanges.length > 0 && (
        <details class="card">
          <summary>{S.max.history}</summary>
          <ul class="plain-list">
            {data.maxChanges.map((m) => (
              <li key={m.id} class="num">
                {S.max.change(S.lifts[m.lift], formatKg(m.from), formatKg(m.to), formatDayShort(m.at.slice(0, 10)))}
              </li>
            ))}
          </ul>
        </details>
      )}

      <section class="card stack">
        <h3>{S.cycle.planning}</h3>
        <p>
          {cycle.weeklyPlan
            .map((e) => `${S.weekdays[e.weekday - 1]} ${templates.get(e.templateId)?.name ?? '?'}`)
            .join(' · ')}
        </p>
      </section>

      <section class="stack">
        <h3>{S.cycle.weeks}</h3>
        <ol class="cycle-weeks">
          {Array.from({ length: cycle.weeksCount }, (_, i) => {
            const week = i + 1;
            const monday = addDays(cycle.startDate, i * 7);
            const inWeek = sessions.filter((s) => s.cycleWeek === week);
            const done = inWeek.filter((s) => ['VALIDATED', 'FAILED', 'INCOMPLETE'].includes(deriveSessionStatus(s, today))).length;
            const tonnage = inWeek.reduce((t, s) => t + sessionTotals(s, cycle.max, settings.rounding).tonnage, 0);
            return (
              <li key={week} class={`card cycle-week${week === currentWeek ? ' is-current' : ''}`}>
                <div class="section-header">
                  <strong>{S.cycle.weekRow(week, formatRange(monday, addDays(monday, 6)))}</strong>
                  <a class="btn small" href={href.duplicateWeek(monday)} aria-label={S.cycle.duplicateThisWeek(week)}>
                    ⧉
                  </a>
                </div>
                <div class="dots">
                  {inWeek.map((s) => (
                    <SessionDot key={s.id} color={colorOf(s)} status={deriveSessionStatus(s, today)} name={sessionLabel(s, s.templateId ? templates.get(s.templateId) : undefined)} />
                  ))}
                </div>
                <span class="muted">
                  {S.cycle.weekProgress(done, inWeek.length)}
                  {tonnage > 0 && <> · <span class="num">{formatTonnage(tonnage)}</span></>}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div class="button-row sticky-actions">
        <a class="btn" href={href.duplicateWeek(currentWeek ? addDays(cycle.startDate, (currentWeek - 1) * 7) : cycle.startDate)}>
          {S.cycle.duplicateWeek}
        </a>
        <a class="btn primary" href={href.duplicateCycle(cycle.id)}>
          {S.cycle.duplicate}
        </a>
      </div>
    </div>
  );
}
