import { useState } from 'preact/hooks';
import { ACTIVITY_COLORS, averageSpeedKmh, paceMinPerKm } from '../../domain/activities';
import { newId } from '../../domain/ids';
import type { ActivityType } from '../../domain/types';
import { isNative } from '../../platform';
import { errorCode } from '../../platform/tracker';
import { commit } from '../actions';
import { TextField } from '../components/fields';
import { TrackMap } from '../components/TrackMap';
import { useApp } from '../context';
import { formatClock, formatKg, formatPace } from '../format';
import { href, navigate } from '../router';
import { S } from '../strings';
import { recording, useRecording } from '../trackStore';

/** Sports enregistrables au GPS (la natation n'a pas de signal). */
const GPS_TYPES: readonly ActivityType[] = ['RUNNING', 'WALKING', 'CYCLING', 'OTHER'];

function Metrics({ type, elapsed, km }: { type: ActivityType; elapsed: number; km: number }) {
  const pace = paceMinPerKm(km, elapsed / 1000);
  const speed = averageSpeedKmh(km, elapsed / 1000);
  const bySpeed = type === 'CYCLING';
  return (
    <dl class="track-metrics">
      <div class="is-main">
        <dt>{S.track.duration}</dt>
        <dd class="num">{formatClock(elapsed)}</dd>
      </div>
      <div>
        <dt>{S.track.distance}</dt>
        <dd class="num">
          {formatKg(Math.floor(km * 100) / 100)} <small>km</small>
        </dd>
      </div>
      <div>
        <dt>{bySpeed ? S.track.speed : S.track.pace}</dt>
        <dd class="num">
          {bySpeed ? (speed === null ? '—' : formatKg(Math.round(speed * 10) / 10)) : pace === null || km < 0.05 ? '—' : formatPace(pace)}{' '}
          <small>{bySpeed ? S.track.speedUnit : S.track.paceUnit}</small>
        </dd>
      </div>
    </dl>
  );
}

export function TrackScreen() {
  const app = useApp();
  const rec = useRecording();
  const [type, setType] = useState<ActivityType>('RUNNING');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null);
  const [note, setNote] = useState('');

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      setError(null);
      try {
        await recording.start(type, S.activityTypes[type]);
      } catch (err) {
        const code = errorCode(err);
        setError(code === 'DENIED' || code === 'GPS_OFF' || code === 'UNAVAILABLE' ? S.track.errors[code] : S.track.errors.other);
      }
    });

  if (!rec) {
    return (
      <div class="stack">
        <div class="chip-row two" role="group" aria-label={S.track.type}>
          {GPS_TYPES.map((t) => (
            <button key={t} type="button" class="chip" aria-pressed={type === t} onClick={() => setType(t)}>
              <span class="dot" style={{ background: ACTIVITY_COLORS[t] }} /> {S.activityTypes[t]}
            </button>
          ))}
        </div>
        <p class="muted">{S.track.intro}</p>
        {!isNative && <p class="muted">{S.track.webNote}</p>}
        {error && (
          <p class="warning" role="alert">
            {error}
          </p>
        )}
        <button type="button" class="btn primary big" disabled={busy} onClick={() => void start()}>
          {S.track.start}
        </button>
      </div>
    );
  }

  const points = recording.points();
  const km = recording.distanceKm();
  const elapsed = recording.elapsedMs();

  if (rec.finished) {
    const draft = recording.draft(newId());
    const save = () =>
      run(async () => {
        if (!draft || draft.distanceKm <= 0) return;
        const activity = note.trim() ? { ...draft, note: note.trim() } : draft;
        if (await commit(app, { saveActivities: [activity] }, S.track.saved)) {
          await recording.clear();
          navigate(href.today(), true);
        }
      });
    const discard = () =>
      run(async () => {
        await recording.clear();
        setConfirm(null);
        app.toast(S.track.discarded);
      });
    return (
      <div class="stack">
        <h2 class="card-title">
          {S.track.summary} · {S.activityTypes[rec.type]}
        </h2>
        <Metrics type={rec.type} elapsed={elapsed} km={km} />
        {points.length > 0 && <TrackMap points={points} />}
        {!draft || draft.distanceKm <= 0 ? (
          <p class="card muted">{S.track.noDistance}</p>
        ) : (
          <TextField label={S.track.note} value={note} onChange={setNote} />
        )}
        {confirm === 'discard' ? (
          <div class="stack">
            <p>{S.track.confirmDiscard}</p>
            <div class="button-row">
              <button type="button" class="btn" onClick={() => setConfirm(null)}>
                {S.common.cancel}
              </button>
              <button type="button" class="btn danger" disabled={busy} onClick={() => void discard()}>
                {S.track.confirmDiscardButton}
              </button>
            </div>
          </div>
        ) : (
          <div class="button-row">
            <button type="button" class="btn danger" onClick={() => setConfirm('discard')}>
              {S.track.discard}
            </button>
            <button type="button" class="btn primary" disabled={busy || !draft || draft.distanceKm <= 0} onClick={() => void save()}>
              {S.track.save}
            </button>
          </div>
        )}
      </div>
    );
  }

  const running = rec.clock.runningSince !== null;
  return (
    <div class="stack">
      <p class="track-status">
        <span class="dot" style={{ background: ACTIVITY_COLORS[rec.type] }} /> {S.activityTypes[rec.type]}
        {!running && <strong> · {S.track.paused}</strong>}
        {running && points.length === 0 && <span class="muted"> · {S.track.waitingFix}</span>}
      </p>
      <Metrics type={rec.type} elapsed={elapsed} km={km} />
      <TrackMap points={points} current={recording.current()} follow />
      {confirm === 'finish' ? (
        <div class="stack">
          <p>{S.track.confirmFinish}</p>
          <div class="button-row">
            <button type="button" class="btn" onClick={() => setConfirm(null)}>
              {S.track.keepGoing}
            </button>
            <button
              type="button"
              class="btn primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await recording.finish();
                  setConfirm(null);
                })
              }
            >
              {S.track.finish}
            </button>
          </div>
        </div>
      ) : (
        <div class="button-row sticky-actions">
          <button type="button" class="btn" disabled={busy} onClick={() => setConfirm('finish')}>
            {S.track.finish}
          </button>
          <button type="button" class="btn primary" disabled={busy} onClick={() => void run(running ? recording.pause : recording.resume)}>
            {running ? S.track.pause : S.track.resume}
          </button>
        </div>
      )}
    </div>
  );
}
