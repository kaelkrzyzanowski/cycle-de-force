import { useState } from 'preact/hooks';
import { activityKcal, isCompleteProfile } from '../../domain/calories';
import { todayIso } from '../../domain/dates';
import {
  averageSteps,
  bucketOf,
  dataRange,
  distanceByBucket,
  exerciseProgress,
  exercisesWithData,
  maxOfCycles,
  PERIODS,
  periodStart,
  realizedSessions,
  stepsByBucket,
  tonnageByBucket,
} from '../../domain/stats';
import type { Bucket, Period } from '../../domain/stats';
import type { Activity, Cycle, DailySteps, IsoDate, Session } from '../../domain/types';
import { ColumnChart } from '../charts/ColumnChart';
import { LineChart } from '../charts/LineChart';
import { ChartCard, Legend, StatTile } from '../charts/parts';
import { useApp, useData } from '../context';
import { formatDayMedium, formatDayShort, formatKcal, formatKg, formatMonthShort, formatMonthYear, formatTonnage } from '../format';
import { S } from '../strings';

interface Data {
  sessions: Session[];
  cycles: Cycle[];
  activities: Activity[];
  steps: DailySteps[];
}

const PREFERRED_EXERCISE = 'deadlift-sumo-inche-mur';
const ALL = ['0000-01-01', '9999-12-31'] as const;

const kg = (v: number) => `${formatKg(v)} kg`;
const km = (v: number) => `${formatKg(v)} km`;
const int = new Intl.NumberFormat('fr-FR');

/** Graduation courte et libellé complet d'une semaine (lundi) ou d'un mois. */
const bucketLabel = (start: IsoDate, bucket: Bucket) => (bucket === 'week' ? formatDayShort(start) : formatMonthShort(start));
const bucketTitle = (start: IsoDate, bucket: Bucket) =>
  bucket === 'week' ? S.stats.weekOf(formatDayShort(start)) : formatMonthYear(start);

export function StatsScreen() {
  const data = useData<Data>(
    async (repo) => ({
      sessions: await repo.listSessionsBetween(...ALL),
      cycles: await repo.listCycles(),
      activities: await repo.listActivitiesBetween(...ALL),
      steps: await repo.listStepsBetween(...ALL),
    }),
    [],
  );
  if (!data) return <p class="muted">{S.loading}</p>;
  return <Stats {...data} />;
}

function Stats({ sessions, cycles, activities, steps }: Data) {
  const { settings } = useApp();
  const { rounding, profile } = settings;
  const today = todayIso();
  const [period, setPeriod] = useState<Period>('3m');
  const bucket = bucketOf(period);
  const range = dataRange(sessions, activities);
  const firstSteps = steps.find((d) => d.steps > 0)?.date;
  const first = [range?.first, firstSteps].filter((d): d is IsoDate => d !== undefined).sort()[0] ?? null;
  const from = periodStart(period, today, first);
  // Une séance validée d'avance (date future) compte aussi.
  const to = range && range.last > today ? range.last : today;
  const maxOf = maxOfCycles(cycles);

  const done = realizedSessions(sessions, from, to);
  const tonnage = tonnageByBucket(done, maxOf, rounding, from, to, bucket);
  const inPeriod = activities.filter((a) => a.date >= from && a.date <= to);
  const distance = distanceByBucket(inPeriod, from, to, bucket);
  const totalKm = Math.round(inPeriod.reduce((t, a) => t + a.distanceKm, 0) * 10) / 10;
  const totalKcal = inPeriod.reduce((t, a) => t + (activityKcal(profile, a) ?? 0), 0);
  const stepsAvg = averageSteps(steps, from, to);
  const stepsSeries = stepsByBucket(steps, from, to, bucket);

  const exercises = exercisesWithData(done);
  const [chosen, setChosen] = useState(PREFERRED_EXERCISE);
  const exerciseId = exercises.some((e) => e.exerciseId === chosen) ? chosen : (exercises[0]?.exerciseId ?? '');
  const progress = exerciseId ? exerciseProgress(done, exerciseId, maxOf, rounding) : [];
  const per = bucket === 'week' ? S.stats.perWeek : S.stats.perMonth;

  return (
    <div class="stack stats">
      <div class="segmented" role="group" aria-label={S.stats.period}>
        {PERIODS.map((p) => (
          <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>
            {S.stats.periods[p]}
          </button>
        ))}
      </div>

      {done.length === 0 && inPeriod.length === 0 && <p class="card muted">{S.stats.empty}</p>}

      <div class={`tiles${(stepsAvg !== null) !== isCompleteProfile(profile) ? ' four' : ''}`}>
        <StatTile label={S.stats.tileSessions} value={String(done.length)} />
        <StatTile label={S.stats.tileTonnage} value={formatTonnage(tonnage.reduce((t, b) => t + b.tonnage, 0))} />
        <StatTile label={S.stats.tileCardio} value={km(totalKm)} />
        {stepsAvg !== null && <StatTile label={S.stats.tileSteps} value={int.format(stepsAvg)} />}
        {isCompleteProfile(profile) && <StatTile label={S.stats.tileCalories} value={formatKcal(totalKcal)} />}
      </div>

      <ChartCard
        title={S.stats.tonnage}
        subtitle={per}
        table={{
          head: [S.stats.colPeriod, S.stats.colTonnage],
          rows: tonnage.filter((b) => b.tonnage > 0).map((b) => [bucketTitle(b.start, bucket), formatKg(b.tonnage)]),
        }}
      >
        <ColumnChart
          ariaLabel={`${S.stats.tonnage}, ${per.toLowerCase()}`}
          formatValue={formatTonnage}
          data={tonnage.map((b) => ({ key: b.start, label: bucketLabel(b.start, bucket), value: b.tonnage, tip: bucketTitle(b.start, bucket) }))}
        />
      </ChartCard>

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
              <select class="text-input" aria-label={S.stats.exerciseSelect} value={exerciseId} onChange={(e) => setChosen(e.currentTarget.value)}>
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

      {stepsAvg !== null && (
        <ChartCard
          title={S.stats.steps}
          subtitle={S.stats.stepsSub(per)}
          table={{
            head: [S.stats.colPeriod, S.stats.colSteps],
            rows: stepsSeries.filter((b) => b.average > 0).map((b) => [bucketTitle(b.start, bucket), int.format(b.average)]),
          }}
        >
          <ColumnChart
            ariaLabel={`${S.stats.steps}, ${S.stats.stepsSub(per).toLowerCase()}`}
            formatValue={(v) => `${int.format(v)} pas`}
            data={stepsSeries.map((b) => ({ key: b.start, label: bucketLabel(b.start, bucket), value: b.average, tip: bucketTitle(b.start, bucket) }))}
          />
        </ChartCard>
      )}

      {inPeriod.length > 0 && (
        <ChartCard
          title={S.stats.cardio}
          subtitle={per}
          table={{
            head: [S.stats.colPeriod, S.stats.colKm],
            rows: distance.filter((b) => b.km > 0).map((b) => [bucketTitle(b.start, bucket), formatKg(b.km)]),
          }}
        >
          <ColumnChart
            ariaLabel={`${S.stats.cardio}, ${per.toLowerCase()}`}
            formatValue={km}
            data={distance.map((b) => ({ key: b.start, label: bucketLabel(b.start, bucket), value: b.km, tip: bucketTitle(b.start, bucket) }))}
          />
        </ChartCard>
      )}
    </div>
  );
}
