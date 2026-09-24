import { useState } from 'preact/hooks';
import { cycleWeekOf, findCycleForDate, generateCycleSessions } from '../../domain/cycles';
import { addDays, mondayOf, todayIso } from '../../domain/dates';
import { newId } from '../../domain/ids';
import { deriveSessionStatus } from '../../domain/sessionStatus';
import type { Cycle, IsoDate, Session, SessionTemplate } from '../../domain/types';
import { exampleCycle } from '../../seed';
import { commit, templatesById } from '../actions';
import { NEUTRAL_COLOR, SessionCard, SessionDot } from '../components/SessionCard';
import { Sheet } from '../components/Sheet';
import { useSwipe } from '../components/useSwipe';
import { useApp, useData } from '../context';
import { formatDayLong, formatMonthYear, formatRange } from '../format';
import { href, navigate } from '../router';
import { S } from '../strings';
import { AddSessionSheet } from '../sheets/AddSessionSheet';
import { SessionActionsSheet } from '../sheets/SessionActionsSheet';

type View = 'month' | 'week';

/** État conservé en mémoire quand on ouvre une séance puis qu'on revient. */
const memory: { view: View; selected: IsoDate | null } = { view: 'month', selected: null };

const firstOfMonth = (d: IsoDate): IsoDate => `${d.slice(0, 7)}-01`;
function shiftMonth(d: IsoDate, delta: number): IsoDate {
  const [y, m] = [Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1 + delta];
  const date = new Date(Date.UTC(y, m, 1));
  return date.toISOString().slice(0, 10);
}

function visibleRange(view: View, selected: IsoDate): { from: IsoDate; to: IsoDate } {
  if (view === 'week') {
    const from = mondayOf(selected);
    return { from, to: addDays(from, 6) };
  }
  const from = mondayOf(firstOfMonth(selected));
  return { from, to: addDays(from, 41) };
}

interface CalendarData {
  sessions: Session[];
  cycles: Cycle[];
  templates: SessionTemplate[];
  exampleDismissed: boolean;
}

export function CalendarScreen() {
  const app = useApp();
  const today = todayIso();
  const [view, setViewState] = useState<View>(memory.view);
  const [selected, setSelectedState] = useState<IsoDate>(memory.selected ?? today);
  const [sheet, setSheet] = useState<{ kind: 'add'; date: IsoDate } | { kind: 'session'; session: Session } | { kind: 'menu' } | null>(
    null,
  );

  const setView = (v: View) => {
    memory.view = v;
    setViewState(v);
  };
  const select = (d: IsoDate) => {
    memory.selected = d;
    setSelectedState(d);
  };

  const { from, to } = visibleRange(view, selected);
  const data = useData<CalendarData>(
    async (repo) => ({
      sessions: await repo.listSessionsBetween(from, to),
      cycles: await repo.listCycles(),
      templates: await repo.listTemplates(),
      exampleDismissed: (await repo.getFlag('exampleOffer')) === 'dismissed',
    }),
    [from, to],
  );

  const step = (delta: number) => select(view === 'week' ? addDays(selected, 7 * delta) : shiftMonth(selected, delta));
  const swipe = useSwipe(
    () => step(-1),
    () => step(1),
  );

  if (!data) return <p class="muted">{S.loading}</p>;

  const templates = templatesById(data.templates);
  const colorOf = (s: Session) => (s.templateId ? templates.get(s.templateId)?.color : undefined) ?? NEUTRAL_COLOR;
  const maxOf = (s: Session) => data.cycles.find((c) => c.id === s.cycleId)?.max ?? { S: 0, B: 0, D: 0 };
  const byDay = new Map<IsoDate, Session[]>();
  for (const s of data.sessions) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);

  const cycle = findCycleForDate(data.cycles, selected);
  const cycleWeek = cycle ? cycleWeekOf(cycle, selected) : null;

  const createExample = async () => {
    const c = exampleCycle(newId(), mondayOf(today));
    const sessions = generateCycleSessions(c, templates, newId);
    await commit(app, { saveCycles: [c], saveSessions: sessions }, S.cycleForm.created(c.name, sessions.length));
  };
  const dismissExample = async () => {
    await app.repo.setFlag('exampleOffer', 'dismissed');
    app.refresh();
  };

  const cards = (day: IsoDate) =>
    (byDay.get(day) ?? []).map((s) => (
      <SessionCard
        key={s.id}
        session={s}
        color={colorOf(s)}
        max={maxOf(s)}
        rounding={app.settings.rounding}
        today={today}
        onOpen={() => navigate(href.session(s.id))}
        onActions={() => setSheet({ kind: 'session', session: s })}
      />
    ));

  const addButton = (day: IsoDate) => (
    <button
      type="button"
      class="icon-btn add-btn"
      aria-label={S.calendar.addSessionOn(formatDayLong(day))}
      onClick={() => setSheet({ kind: 'add', date: day })}
    >
      +
    </button>
  );

  return (
    <div class="stack calendar">
      <div class="cal-toolbar">
        <div class="segmented" role="group" aria-label={S.calendar.viewLabel}>
          <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>
            {S.calendar.month}
          </button>
          <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>
            {S.calendar.week}
          </button>
        </div>
        <div class="cal-nav">
          <button type="button" class="icon-btn" aria-label={S.calendar.previous} onClick={() => step(-1)}>
            ‹
          </button>
          <h2 aria-live="polite">
            {view === 'month' ? formatMonthYear(selected) : formatRange(from, to)}
          </h2>
          <button type="button" class="icon-btn" aria-label={S.calendar.next} onClick={() => step(1)}>
            ›
          </button>
          <button type="button" class="btn small" onClick={() => select(today)} disabled={selected === today}>
            {S.calendar.today}
          </button>
        </div>
      </div>

      {cycle && cycleWeek ? (
        <a class="cycle-banner" href={href.cycle(cycle.id)}>
          {S.calendar.cycleBanner(cycle.name, cycleWeek, cycle.weeksCount)}
          <span aria-hidden="true">›</span>
        </a>
      ) : (
        <p class="cycle-banner muted">{S.calendar.noCycle}</p>
      )}

      {data.cycles.length === 0 && !data.exampleDismissed && (
        <section class="card stack">
          <h3>{S.example.title}</h3>
          <p>{S.example.text}</p>
          <div class="button-row">
            <button type="button" class="btn" onClick={dismissExample}>
              {S.example.later}
            </button>
            <button type="button" class="btn primary" onClick={createExample}>
              {S.example.create}
            </button>
          </div>
        </section>
      )}

      <div {...swipe}>
        {view === 'month' ? (
          <MonthGrid
            from={from}
            month={selected.slice(0, 7)}
            selected={selected}
            today={today}
            byDay={byDay}
            colorOf={colorOf}
            onSelect={select}
          />
        ) : (
          <ol class="week-list">
            {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((day) => (
              <li key={day} class={`week-day${day === today ? ' is-today' : ''}`}>
                <div class="week-day-header">
                  <h3>{formatDayLong(day)}</h3>
                  {addButton(day)}
                </div>
                {cards(day)}
              </li>
            ))}
          </ol>
        )}
      </div>

      {view === 'month' && (
        <section class="day-panel stack" aria-live="polite">
          <div class="week-day-header">
            <h3>{formatDayLong(selected)}</h3>
            {addButton(selected)}
          </div>
          {(byDay.get(selected) ?? []).length === 0 && <p class="muted">{S.calendar.noSessions}</p>}
          {cards(selected)}
        </section>
      )}

      <button type="button" class="fab" aria-label={S.calendar.actions} onClick={() => setSheet({ kind: 'menu' })}>
        +
      </button>

      {sheet?.kind === 'add' && (
        <AddSessionSheet date={sheet.date} cycles={data.cycles} templates={data.templates} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'session' && (
        <SessionActionsSheet session={sheet.session} cycles={data.cycles} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'menu' && (
        <Sheet title={S.calendar.actions} onClose={() => setSheet(null)}>
          <div class="choice-list">
            <button type="button" class="choice" onClick={() => setSheet({ kind: 'add', date: selected })}>
              {S.calendar.addSessionOn(formatDayLong(selected))}
            </button>
            <button type="button" class="choice" onClick={() => navigate(href.newCycle())}>
              {S.cycleForm.newTitle}
            </button>
            <button type="button" class="choice" onClick={() => navigate(href.duplicateWeek(mondayOf(selected)))}>
              {S.duplicateWeek.title}
            </button>
            {cycle && (
              <button type="button" class="choice" onClick={() => navigate(href.duplicateCycle(cycle.id))}>
                {`${S.duplicateCycle.title} « ${cycle.name} »`}
              </button>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}

interface GridProps {
  from: IsoDate;
  month: string; // 'AAAA-MM'
  selected: IsoDate;
  today: IsoDate;
  byDay: ReadonlyMap<IsoDate, Session[]>;
  colorOf: (s: Session) => string;
  onSelect: (d: IsoDate) => void;
}

function MonthGrid({ from, month, selected, today, byDay, colorOf, onSelect }: GridProps) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  // Ne pas afficher une 6e ligne entièrement hors du mois.
  const visible = days.slice(35).some((d) => d.startsWith(month)) ? days : days.slice(0, 35);
  return (
    <div class="month-grid" role="grid">
      <div class="month-row" role="row">
        {S.weekdaysShort.map((d, i) => (
          <span key={i} class="month-weekday" role="columnheader" aria-label={S.weekdays[i]}>
            {d}
          </span>
        ))}
      </div>
      {Array.from({ length: visible.length / 7 }, (_, r) => (
        <div key={r} class="month-row" role="row">
          {visible.slice(r * 7, r * 7 + 7).map((day) => {
            const sessions = byDay.get(day) ?? [];
            const classes = [
              'month-cell',
              day.startsWith(month) ? '' : 'is-outside',
              day === today ? 'is-today' : '',
              day === selected ? 'is-selected' : '',
            ].join(' ');
            return (
              <button
                key={day}
                type="button"
                role="gridcell"
                class={classes}
                aria-selected={day === selected}
                aria-label={`${formatDayLong(day)}, ${S.calendar.daySessions(sessions.length)}`}
                onClick={() => onSelect(day)}
              >
                <span class="month-day num">{Number(day.slice(8))}</span>
                <span class="dots">
                  {sessions.map((s) => (
                    <SessionDot key={s.id} color={colorOf(s)} status={deriveSessionStatus(s, today)} name={s.name} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
