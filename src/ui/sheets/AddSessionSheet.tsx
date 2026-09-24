import { useState } from 'preact/hooks';
import { emptySession, findCycleForDate, placementFor, sessionFromTemplate } from '../../domain/cycles';
import { newId } from '../../domain/ids';
import type { Cycle, IsoDate, SessionTemplate } from '../../domain/types';
import { commit } from '../actions';
import { Sheet } from '../components/Sheet';
import { useApp } from '../context';
import { formatDayMedium } from '../format';
import { S } from '../strings';

interface Props {
  date: IsoDate;
  cycles: readonly Cycle[];
  templates: readonly SessionTemplate[];
  onClose: () => void;
}

/** Choisir la semaine du modèle (pré-sélectionnée selon le cycle), puis un modèle : 2 taps. */
export function AddSessionSheet({ date, cycles, templates, onClose }: Props) {
  const app = useApp();
  const placement = placementFor(date, cycles);
  const cycle = findCycleForDate(cycles, date);
  const maxWeeks = Math.max(1, ...templates.map((t) => t.weeksCount), cycle?.weeksCount ?? 1);
  const [week, setWeek] = useState(placement.cycleWeek ?? 1);

  const add = async (template: SessionTemplate | null) => {
    const session = template
      ? sessionFromTemplate(template, week, placement, newId)
      : emptySession(S.addSession.emptyName, placement, newId);
    if (await commit(app, { saveSessions: [session] }, S.addSession.added)) onClose();
  };

  return (
    <Sheet title={S.addSession.title(formatDayMedium(date))} onClose={onClose}>
      <p class="muted">
        {cycle && placement.cycleWeek ? S.addSession.inCycle(cycle.name, placement.cycleWeek) : S.addSession.outOfCycle}
      </p>
      <div class="field">
        <span id="add-week">{S.addSession.week}</span>
        <div class="segmented scroll" role="group" aria-labelledby="add-week">
          {Array.from({ length: maxWeeks }, (_, i) => i + 1).map((w) => (
            <button key={w} type="button" class="num" aria-pressed={week === w} onClick={() => setWeek(w)}>
              {S.addSession.weekShort(w)}
            </button>
          ))}
        </div>
      </div>
      <div class="field">
        <span>{S.addSession.template}</span>
        <div class="choice-list">
          {templates.map((t) => (
            <button key={t.id} type="button" class="choice" onClick={() => add(t)}>
              <span class="swatch" style={{ background: t.color }} />
              {t.name}
            </button>
          ))}
          <button type="button" class="choice" onClick={() => add(null)}>
            <span class="swatch empty" />
            {S.addSession.empty}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
