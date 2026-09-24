import { findCycleForDate } from '../../domain/cycles';
import { addDays, todayIso } from '../../domain/dates';
import type { Cycle, Session, SessionTemplate } from '../../domain/types';
import { templatesById } from '../actions';
import { BackupReminder } from '../components/BackupReminder';
import { MaxCard } from '../components/MaxCard';
import { NEUTRAL_COLOR, SessionCard } from '../components/SessionCard';
import { useApp, useData } from '../context';
import { formatDayLong } from '../format';
import { href, navigate } from '../router';
import { S } from '../strings';

interface Data {
  today: Session[];
  upcoming: Session | undefined;
  cycles: Cycle[];
  templates: SessionTemplate[];
}

export function TodayScreen() {
  const { settings } = useApp();
  const today = todayIso();
  const data = useData<Data>(
    async (repo) => {
      const todaySessions = await repo.listSessionsBetween(today, today);
      const next = todaySessions.length ? [] : await repo.listSessionsBetween(addDays(today, 1), addDays(today, 60));
      return { today: todaySessions, upcoming: next[0], cycles: await repo.listCycles(), templates: await repo.listTemplates() };
    },
    [today],
  );
  if (!data) return <p class="muted">{S.loading}</p>;

  const templates = templatesById(data.templates);
  const cycle = findCycleForDate(data.cycles, today) ?? data.cycles.find((c) => c.id === data.upcoming?.cycleId);
  const card = (s: Session) => (
    <SessionCard
      key={s.id}
      session={s}
      color={(s.templateId ? templates.get(s.templateId)?.color : undefined) ?? NEUTRAL_COLOR}
      max={data.cycles.find((c) => c.id === s.cycleId)?.max ?? { S: 0, B: 0, D: 0 }}
      rounding={settings.rounding}
      today={today}
      onOpen={() => navigate(href.session(s.id))}
      onActions={() => navigate(href.session(s.id))}
    />
  );

  return (
    <div class="stack">
      <BackupReminder hasData={data.cycles.length > 0} />
      <h2>{formatDayLong(today)}</h2>
      {data.today.map(card)}
      {data.today.length === 0 && (
        <>
          <p class="card">{S.today.noSession}</p>
          {data.upcoming && (
            <>
              <p class="muted">{S.today.next(formatDayLong(data.upcoming.date).toLowerCase())}</p>
              {card(data.upcoming)}
            </>
          )}
          <a class="btn" href={href.calendar()}>
            {S.today.toCalendar}
          </a>
        </>
      )}
      {cycle && <MaxCard cycle={cycle} />}
    </div>
  );
}
