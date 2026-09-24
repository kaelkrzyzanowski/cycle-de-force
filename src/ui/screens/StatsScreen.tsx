import { useState } from 'preact/hooks';
import { findCycleForDate } from '../../domain/cycles';
import { todayIso } from '../../domain/dates';
import { isRealized } from '../../domain/load';
import { deriveSessionStatus } from '../../domain/sessionStatus';
import {
  exerciseProgress,
  exercisesWithData,
  maxHistory,
  maxOfCycles,
  statusBreakdown,
  tonnageByCycle,
  tonnageBySession,
  tonnageByWeek,
  volumeByTemplate,
} from '../../domain/stats';
import { sessionLabel } from '../../domain/templates';
import { LIFTS } from '../../domain/types';
import type { Cycle, MaxChange, Session, SessionTemplate, SetStatus } from '../../domain/types';
import { ColumnChart } from '../charts/ColumnChart';
import { LineChart } from '../charts/LineChart';
import type { LinePoint } from '../charts/LineChart';
import { ChartCard, HBars, Legend, StackedBars, StatTile } from '../charts/parts';
import { SET_GLYPH } from '../session/SetPill';
import { useApp, useData } from '../context';
import { formatDayMedium, formatDayShort, formatKg, formatTonnage } from '../format';
import { S } from '../strings';

interface Data {
  sessions: Session[];
  cycles: Cycle[];
  templates: SessionTemplate[];
  changes: MaxChange[];
}

const PREFERRED_EXERCISE = 'deadlift-sumo-inche-mur';
const LIFT_COLORS = { S: '--series-1', B: '--series-2', D: '--series-3' } as const;
/** Ordre validé (daltonisme) : l'échec ne touche jamais le validé ni le non réalisé. */
const STATUS_ORDER: { status: Exclude<SetStatus, 'PLANNED'>; color: string }[] = [
  { status: 'VALIDATED', color: '--chart-validated' },
  { status: 'NOT_DONE', color: '--chart-not-done' },
  { status: 'CLUSTER', color: '--chart-cluster' },
  { status: 'FAILED', color: '--chart-failed' },
];

const kg = (v: number) => `${formatKg(v)} kg`;

/** Prolonge la dernière valeur jusqu'à `end` (courbe en marches). */
function carryForward(points: LinePoint[], end: string): LinePoint[] {
  const last = points.at(-1);
  return last && last.date < end ? [...points, { date: end, value: last.value, carried: true }] : points;
}

export function StatsScreen() {
  const data = useData<Data>(
    async (repo) => ({
      sessions: await repo.listSessionsBetween('0000-01-01', '9999-12-31'),
      cycles: await repo.listCycles(),
      templates: await repo.listTemplates(),
      changes: await repo.listMaxChanges(),
    }),
    [],
  );
  if (!data) return <p class="muted">{S.loading}</p>;
  return <Stats {...data} />;
}

function Stats({ sessions, cycles, templates, changes }: Data) {
  const { settings } = useApp();
  const { rounding } = settings;
  const today = todayIso();
  const [cycleId, setCycleId] = useState<string | null>(
    () => (findCycleForDate(cycles, today) ?? cycles.at(-1))?.id ?? null,
  );
  const exercises = exercisesWithData(sessions);
  const [exerciseId, setExerciseId] = useState(
    exercises.find((e) => e.exerciseId === PREFERRED_EXERCISE)?.exerciseId ?? exercises[0]?.exerciseId ?? '',
  );

  const maxOf = maxOfCycles(cycles);
  const cycle = cycles.find((c) => c.id === cycleId);
  const inCycle = cycle ? sessions.filter((s) => s.cycleId === cycle.id) : [];
  const realizedSets = inCycle.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.filter((x) => isRealized(x.status)).length, 0), 0);
  const hasData = sessions.some((s) => s.exercises.some((e) => e.sets.some((x) => x.status !== 'PLANNED')));

  const weeks = cycle ? tonnageByWeek(cycle, sessions, rounding) : [];
  const perSession = tonnageBySession(inCycle, maxOf, rounding).filter((s) => s.tonnage > 0);
  const perCycle = tonnageByCycle(cycles, sessions, rounding);
  const progress = exerciseId ? exerciseProgress(sessions, exerciseId, maxOf, rounding) : [];
  const history = maxHistory(cycles, changes);
  const volume = volumeByTemplate(inCycle, maxOf, rounding);
  const labelOf = (s: { name: string; cycleWeek: number | null; templateId: string | null }) =>
    sessionLabel(s, templates.find((t) => t.id === s.templateId));
  const templateName = (id: string | null) => templates.find((t) => t.id === id)?.name ?? S.stats.noTemplate;
  const templateColor = (id: string | null) => templates.find((t) => t.id === id)?.color ?? '#6b7280';
  // Les marches se prolongent jusqu'à aujourd'hui (ou jusqu'au dernier changement s'il est futur).
  const lastChange = LIFTS.flatMap((l) => history[l].map((p) => p.date)).sort().at(-1) ?? today;
  const maxEnd = lastChange > today ? lastChange : today;
  const done = inCycle.filter((s) => ['VALIDATED', 'FAILED', 'INCOMPLETE'].includes(deriveSessionStatus(s, today))).length;

  return (
    <div class="stack stats">
      {cycles.length > 0 && (
        <label class="field">
          <span>{S.stats.cycle}</span>
          <select class="text-input" value={cycleId ?? ''} onChange={(e) => setCycleId(e.currentTarget.value)}>
            {[...cycles].reverse().map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!hasData && <p class="card muted">{S.stats.empty}</p>}

      {cycle && (
        <div class="tiles">
          <StatTile label={S.stats.tileTonnage} value={formatTonnage(weeks.reduce((t, w) => t + w.tonnage, 0))} />
          <StatTile label={S.stats.tileSessions} value={`${done}/${inCycle.length}`} />
          <StatTile label={S.stats.tileSets} value={String(realizedSets)} />
        </div>
      )}

      {cycle && (
        <ChartCard
          title={S.stats.byWeek}
          subtitle={cycle.name}
          table={{ head: [S.stats.colWeek, S.stats.colTonnage], rows: weeks.map((w) => [S.common.week(w.week), formatKg(w.tonnage)]) }}
        >
          <ColumnChart
            ariaLabel={`${S.stats.byWeek}, ${cycle.name}`}
            formatValue={formatTonnage}
            data={weeks.map((w) => ({ key: String(w.week), label: S.common.week(w.week), value: w.tonnage, tip: `${cycle.name} · ${S.common.week(w.week)}` }))}
          />
        </ChartCard>
      )}

      {perSession.length > 0 && (
        <ChartCard
          title={S.stats.bySession}
          subtitle={cycle?.name}
          table={{
            head: [S.stats.colDate, S.stats.colSession, S.stats.colTonnage],
            rows: perSession.map((s) => [formatDayMedium(s.date), labelOf(s), formatKg(s.tonnage)]),
          }}
        >
          <ColumnChart
            ariaLabel={S.stats.bySession}
            formatValue={formatTonnage}
            data={perSession.map((s) => ({
              key: s.sessionId,
              label: formatDayShort(s.date),
              value: s.tonnage,
              tip: `${labelOf(s)} · ${formatDayMedium(s.date)}`,
            }))}
          />
        </ChartCard>
      )}

      <ChartCard
        title={S.stats.exercise}
        subtitle={S.stats.exerciseSub}
        legend={
          progress.length > 0 && (
            <Legend
              items={[
                { label: S.stats.maxKg, color: '--series-1', line: true },
                { label: S.stats.e1rm, color: '--series-2', line: true },
              ]}
            />
          )
        }
        table={{
          head: [S.stats.colDate, S.stats.maxKg, S.stats.e1rm],
          rows: progress.map((p) => [formatDayMedium(p.date), formatKg(p.maxKg), p.e1rm === null ? '—' : formatKg(p.e1rm)]),
        }}
      >
        {exercises.length === 0 ? (
          <p class="muted">{S.stats.noExercise}</p>
        ) : (
          <>
            <label class="field">
              <span class="sr-only">{S.stats.exerciseSelect}</span>
              <select
                class="text-input"
                aria-label={S.stats.exerciseSelect}
                value={exerciseId}
                onChange={(e) => setExerciseId(e.currentTarget.value)}
              >
                {exercises.map((e) => (
                  <option key={e.exerciseId} value={e.exerciseId}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <LineChart
              ariaLabel={`${S.stats.exercise} : ${exercises.find((e) => e.exerciseId === exerciseId)?.name ?? ''}`}
              formatValue={kg}
              formatDate={formatDayShort}
              series={[
                { id: 'max', label: S.stats.maxKg, color: '--series-1', points: progress.map((p) => ({ date: p.date, value: p.maxKg })) },
                {
                  id: 'e1rm',
                  label: S.stats.e1rm,
                  color: '--series-2',
                  points: progress.flatMap((p) => (p.e1rm === null ? [] : [{ date: p.date, value: p.e1rm }])),
                },
              ]}
            />
          </>
        )}
      </ChartCard>

      {cycles.length > 0 && (
        <ChartCard
          title={S.stats.maxes}
          subtitle={S.stats.maxesSub}
          legend={<Legend items={LIFTS.map((l) => ({ label: S.lifts[l], color: LIFT_COLORS[l], line: true }))} />}
          table={{
            head: [S.stats.colDate, S.stats.colCycle, ...LIFTS.map((l) => S.lifts[l])],
            rows: [...new Set(LIFTS.flatMap((l) => history[l].map((p) => p.date)))].sort().map((date) => [
              formatDayMedium(date),
              LIFTS.map((l) => history[l].find((p) => p.date === date)?.cycleName).find(Boolean) ?? '',
              ...LIFTS.map((l) => {
                const p = [...history[l]].reverse().find((q) => q.date <= date);
                return p ? formatKg(p.value) : '—';
              }),
            ]),
          }}
        >
          <LineChart
            step
            ariaLabel={S.stats.maxes}
            formatValue={kg}
            formatDate={formatDayShort}
            series={LIFTS.map((l) => ({
              id: l,
              label: S.lifts[l],
              color: LIFT_COLORS[l],
              points: carryForward(
                history[l].map((p) => ({ date: p.date, value: p.value })),
                maxEnd,
              ),
            }))}
          />
        </ChartCard>
      )}

      {cycles.length > 0 && hasData && (
        <ChartCard
          title={S.stats.statuses}
          subtitle={S.stats.statusesSub}
          legend={
            <Legend items={STATUS_ORDER.map((s) => ({ label: S.setStatus[s.status], color: s.color, glyph: SET_GLYPH[s.status] }))} />
          }
          table={{
            head: [S.stats.colCycle, ...STATUS_ORDER.map((s) => S.setStatus[s.status])],
            rows: cycles.map((c) => {
              const counts = statusBreakdown(sessions.filter((s) => s.cycleId === c.id));
              return [c.name, ...STATUS_ORDER.map((s) => counts[s.status])];
            }),
          }}
        >
          <StackedBars
            rows={[...cycles].reverse().map((c) => {
              const counts = statusBreakdown(sessions.filter((s) => s.cycleId === c.id));
              return {
                key: c.id,
                label: c.name,
                note: S.stats.planned(counts.PLANNED),
                segments: STATUS_ORDER.map((s) => ({
                  key: s.status,
                  label: S.setStatus[s.status],
                  glyph: SET_GLYPH[s.status],
                  color: s.color,
                  value: counts[s.status],
                })),
              };
            })}
          />
        </ChartCard>
      )}

      {volume.length > 0 && (
        <ChartCard
          title={S.stats.volume}
          subtitle={cycle?.name}
          table={{
            head: [S.templateEditor.title, S.stats.colTonnage, S.stats.colSessions],
            rows: volume.map((v) => [templateName(v.templateId), formatKg(v.tonnage), v.sessions]),
          }}
        >
          <HBars
            formatValue={formatTonnage}
            rows={volume.map((v) => ({
              key: v.templateId ?? 'none',
              label: templateName(v.templateId),
              swatch: templateColor(v.templateId),
              value: v.tonnage,
              detail: S.stats.sessionsN(v.sessions),
            }))}
          />
        </ChartCard>
      )}

      {perCycle.length > 1 && (
        <ChartCard
          title={S.stats.byCycle}
          table={{ head: [S.stats.colCycle, S.stats.colTonnage], rows: perCycle.map((c) => [c.name, formatKg(c.tonnage)]) }}
        >
          <ColumnChart
            ariaLabel={S.stats.byCycle}
            formatValue={formatTonnage}
            data={perCycle.map((c) => ({ key: c.cycleId, label: c.name, value: c.tonnage, tip: c.name }))}
          />
        </ChartCard>
      )}
    </div>
  );
}
