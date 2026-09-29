import { useEffect, useState } from 'preact/hooks';
import { capitalize, formatCountdown, formatStopwatch } from '../format';
import { S } from '../strings';
import { timer, useTimer } from '../timer';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function ClockCard() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <section class="card stack tight">
      <h2 class="card-title">{S.chrono.clock}</h2>
      <p class="num" style={{ fontSize: '2.5rem', textAlign: 'center' }}>
        {timeFmt.format(now)}
      </p>
      <p class="muted" style={{ textAlign: 'center' }}>
        {capitalize(dateFmt.format(now))}
      </p>
    </section>
  );
}

/** Repos les plus courants : un geste choisit la durée et lance le compte à rebours. */
const PRESETS_S = [30, 60, 90, 120, 180, 300];

function TimerCard() {
  const { state, remainingMs } = useTimer();
  const { phase } = state;
  const done = phase === 'done';
  return (
    <section class={`card stack timer-card${done ? ' is-done' : ''}`} aria-labelledby="timer-title">
      <h2 id="timer-title" class="card-title">
        {S.chrono.timer}
      </h2>
      <div class="timer-display">
        <button type="button" class="btn" aria-label={S.chrono.minus15} disabled={done} onClick={() => timer.adjust(-15_000)}>
          −15 s
        </button>
        <p class="num big-time" role="timer" aria-live={done ? 'assertive' : 'off'}>
          {done ? S.chrono.timeUp : formatCountdown(remainingMs)}
        </p>
        <button type="button" class="btn" aria-label={S.chrono.plus15} disabled={done} onClick={() => timer.adjust(15_000)}>
          +15 s
        </button>
      </div>
      <div class="chip-row" role="group" aria-label={S.chrono.presets}>
        {PRESETS_S.map((s) => (
          <button key={s} type="button" class="btn small" onClick={() => timer.preset(s * 1000)}>
            {formatCountdown(s * 1000)}
          </button>
        ))}
      </div>
      <div class="button-row">
        {phase === 'running' && (
          <>
            <button type="button" class="btn" onClick={timer.reset}>
              {S.chrono.reset}
            </button>
            <button type="button" class="btn primary" onClick={timer.pause}>
              {S.chrono.pause}
            </button>
          </>
        )}
        {phase === 'paused' && (
          <>
            <button type="button" class="btn" onClick={timer.reset}>
              {S.chrono.reset}
            </button>
            <button type="button" class="btn primary" onClick={timer.start}>
              {S.chrono.resume}
            </button>
          </>
        )}
        {phase === 'idle' && (
          <button type="button" class="btn primary" onClick={timer.start}>
            {S.chrono.start}
          </button>
        )}
        {done && (
          <>
            <button type="button" class="btn" onClick={timer.reset}>
              {S.chrono.ok}
            </button>
            <button type="button" class="btn primary" onClick={timer.start}>
              {S.chrono.restart(formatCountdown(state.durationMs))}
            </button>
          </>
        )}
      </div>
      <p class="muted">{S.chrono.timerNote}</p>
    </section>
  );
}

/** État du chronomètre conservé en mémoire : reste en cours en changeant d'onglet. */
interface StopwatchMemory {
  running: boolean;
  startedAt: number | null; // Date.now() au dernier départ/reprise
  accumulatedMs: number;
  laps: number[]; // temps écoulé (ms) à chaque tour, le plus récent en premier
}
const memory: StopwatchMemory = { running: false, startedAt: null, accumulatedMs: 0, laps: [] };

function elapsedMs(): number {
  return memory.accumulatedMs + (memory.running && memory.startedAt !== null ? Date.now() - memory.startedAt : 0);
}

function StopwatchCard() {
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!memory.running) return;
    const id = setInterval(bump, 100);
    return () => clearInterval(id);
  }, [memory.running]);

  const start = () => {
    memory.running = true;
    memory.startedAt = Date.now();
    bump();
  };
  const pause = () => {
    memory.accumulatedMs = elapsedMs();
    memory.running = false;
    memory.startedAt = null;
    bump();
  };
  const reset = () => {
    memory.running = false;
    memory.startedAt = null;
    memory.accumulatedMs = 0;
    memory.laps = [];
    bump();
  };
  const lap = () => {
    memory.laps = [elapsedMs(), ...memory.laps];
    bump();
  };

  return (
    <section class="card stack">
      <h2 class="card-title">{S.chrono.stopwatch}</h2>
      <p class="num" style={{ fontSize: '2.5rem', textAlign: 'center' }}>
        {formatStopwatch(elapsedMs())}
      </p>
      <div class="button-row">
        {memory.running ? (
          <>
            <button type="button" class="btn" onClick={lap}>
              {S.chrono.lap}
            </button>
            <button type="button" class="btn primary" onClick={pause}>
              {S.chrono.pause}
            </button>
          </>
        ) : (
          <>
            {memory.accumulatedMs > 0 && (
              <button type="button" class="btn" onClick={reset}>
                {S.chrono.reset}
              </button>
            )}
            <button type="button" class="btn primary" onClick={start}>
              {memory.accumulatedMs > 0 ? S.chrono.resume : S.chrono.start}
            </button>
          </>
        )}
      </div>
      {memory.laps.length > 0 && (
        <ol class="stack tight">
          {memory.laps.map((t, i) => (
            <li key={memory.laps.length - i} class="number-field">
              <span class="number-label">{S.chrono.lapNumber(memory.laps.length - i)}</span>
              <span class="num">{formatStopwatch(t)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ChronoScreen() {
  return (
    <div class="stack">
      <ClockCard />
      <TimerCard />
      <StopwatchCard />
    </div>
  );
}
