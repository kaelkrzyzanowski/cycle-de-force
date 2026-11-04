import { useEffect, useState } from 'preact/hooks';
import { addDays, todayIso } from '../../domain/dates';
import { goalProgress, lastDays, stepsToKm } from '../../domain/steps';
import { errorCode, Tracker } from '../../platform/tracker';
import type { StepStatus } from '../../platform/tracker';
import { useApp, useData } from '../context';
import { formatKg } from '../format';
import { S } from '../strings';
import { syncSteps } from '../stepsSync';

const LIVE_MS = 10_000;
const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;
const int = new Intl.NumberFormat('fr-FR');
const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow', timeZone: 'UTC' });

/** Anneau vers l'objectif du jour, total et distance estimée, puis les 7 derniers jours. */
export function StepsCard() {
  const app = useApp();
  const today = todayIso();
  const stored = useData((repo) => repo.listStepsBetween(addDays(today, -6), today), [today]);
  const [status, setStatus] = useState<StepStatus | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Tracker.stepStatus().then(setStatus, () => setStatus({ available: false, granted: false, enabled: false }));
  }, []);

  // Compte du jour en direct depuis le podomètre, sans attendre la synchronisation.
  const enabled = status?.enabled ?? false;
  useEffect(() => {
    if (!enabled) return;
    const read = () => void Tracker.getSteps().then(({ days }) => setLive(days[todayIso()] ?? 0), () => undefined);
    read();
    const id = window.setInterval(read, LIVE_MS);
    return () => window.clearInterval(id);
  }, [enabled]);

  if (!status || !stored) return null;
  const hasData = stored.some((d) => d.steps > 0);
  if (!status.available && !hasData) return null;

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await Tracker.startSteps();
      setStatus(await Tracker.stepStatus());
      await syncSteps(app.repo);
      app.toast(S.steps.enabled);
    } catch (err) {
      setMessage(errorCode(err) === 'NO_SENSOR' ? S.steps.noSensor : S.steps.denied);
    } finally {
      setBusy(false);
    }
  };

  if (!status.enabled && !hasData) {
    return (
      <section class="card stack tight">
        <h2 class="card-title">{S.steps.title}</h2>
        <p class="muted">{S.steps.enableHint}</p>
        {message && (
          <p class="warning" role="alert">
            {message}
          </p>
        )}
        <button type="button" class="btn primary" disabled={busy} onClick={() => void enable()}>
          {S.steps.enable}
        </button>
      </section>
    );
  }

  const goal = app.settings.stepGoal;
  const days = lastDays(stored, today, 7);
  const todaySteps = Math.max(live ?? 0, days.at(-1)?.steps ?? 0);
  days[days.length - 1] = { date: today, steps: todaySteps };
  const progress = goalProgress(todaySteps, goal);
  const reached = progress >= 1;
  const peak = Math.max(goal, ...days.map((d) => d.steps));

  return (
    <section class="card steps-card" aria-label={S.steps.today}>
      <svg class={`steps-ring${reached ? ' is-reached' : ''}`} viewBox="0 0 104 104" aria-hidden="true">
        <circle class="track" cx="52" cy="52" r={RING_R} fill="none" stroke-width="10" />
        <circle
          class="progress"
          cx="52"
          cy="52"
          r={RING_R}
          fill="none"
          stroke-width="10"
          stroke-linecap="round"
          stroke-dasharray={RING_C}
          stroke-dashoffset={RING_C * (1 - progress)}
          transform="rotate(-90 52 52)"
        />
      </svg>
      <div>
        <p class="muted" style={{ margin: 0 }}>
          {S.steps.today}
        </p>
        <p class="steps-count num">{int.format(todaySteps)}</p>
        <p class="muted num" style={{ margin: 0 }}>
          {reached ? S.steps.reached : S.steps.goal(int.format(goal))} · {S.steps.km(formatKg(stepsToKm(todaySteps)))}
        </p>
        {!status.enabled && status.available && (
          <button type="button" class="btn" style={{ marginTop: 8 }} disabled={busy} onClick={() => void enable()}>
            {S.steps.enable}
          </button>
        )}
        {message && (
          <p class="warning" role="alert">
            {message}
          </p>
        )}
      </div>
      <ul class="steps-week" aria-label={S.steps.week}>
        {days.map((d) => (
          <li key={d.date}>
            <span
              role="img"
              class={`bar${d.steps >= goal ? ' is-reached' : ''}`}
              style={{ height: `${Math.round((d.steps / peak) * 44)}px` }}
              aria-label={S.steps.dayTip(weekday.format(new Date(`${d.date}T00:00:00Z`)), int.format(d.steps))}
            />
            <span aria-hidden="true">{weekday.format(new Date(`${d.date}T00:00:00Z`))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
