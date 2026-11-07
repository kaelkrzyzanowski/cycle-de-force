import { useEffect, useState } from 'preact/hooks';
import { COUNTDOWN_PRESETS_SEC, countdownPhase, remainingMs } from '../../domain/countdown';
import { NumberField } from '../components/NumberField';
import { countdown, useCountdown } from '../countdownStore';
import { capitalize, formatCountdown, formatShortDuration, formatStopwatch } from '../format';
import { S } from '../strings';

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

function TimerCard() {
  const state = useCountdown();
  const now = Date.now();
  const phase = countdownPhase(state, now);
  const left = remainingMs(state, now);
  const durationSec = Math.round(state.durationMs / 1000);
  const setDuration = (min: number, sec: number) => countdown.setDuration((min * 60 + sec) * 1000);

  return (
    <section class={`card stack timer-card${phase === 'done' ? ' is-done' : ''}`}>
      <h2 class="card-title">{S.chrono.timer}</h2>
      <p class="num timer-display" role="timer" aria-live={phase === 'done' ? 'assertive' : 'off'}>
        {phase === 'done' ? S.chrono.timerFinished : formatCountdown(left)}
      </p>

      {phase === 'idle' && (
        <>
          <div class="field">
            <span id="timer-presets">{S.chrono.timerPresets}</span>
            <div class="chip-row" role="group" aria-labelledby="timer-presets">
              {COUNTDOWN_PRESETS_SEC.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  class="chip"
                  aria-pressed={durationSec === sec}
                  onClick={() => countdown.setDuration(sec * 1000)}
                >
                  {formatShortDuration(sec)}
                </button>
              ))}
            </div>
          </div>
          <div class="button-row start">
            <NumberField
              label={S.chrono.timerMinutes}
              value={Math.floor(durationSec / 60)}
              onChange={(m) => setDuration(m, durationSec % 60)}
              min={0}
              max={99}
              buttons={false}
            />
            <NumberField
              label={S.chrono.timerSeconds}
              value={durationSec % 60}
              onChange={(s) => setDuration(Math.floor(durationSec / 60), s)}
              min={0}
              max={59}
              buttons={false}
            />
          </div>
        </>
      )}

      <div class="button-row">
        {phase === 'idle' && (
          <button type="button" class="btn primary" disabled={durationSec === 0} onClick={countdown.start}>
            {S.chrono.start}
          </button>
        )}
        {phase === 'running' && (
          <>
            <button type="button" class="btn" onClick={countdown.reset}>
              {S.chrono.timerStop}
            </button>
            <button type="button" class="btn" onClick={() => countdown.add(30_000)}>
              {S.chrono.timerAdd(formatShortDuration(30))}
            </button>
            <button type="button" class="btn primary" onClick={countdown.pause}>
              {S.chrono.pause}
            </button>
          </>
        )}
        {phase === 'paused' && (
          <>
            <button type="button" class="btn" onClick={countdown.reset}>
              {S.chrono.timerStop}
            </button>
            <button type="button" class="btn primary" onClick={countdown.start}>
              {S.chrono.resume}
            </button>
          </>
        )}
        {phase === 'done' && (
          <>
            <button type="button" class="btn" onClick={countdown.reset}>
              {S.common.close}
            </button>
            <button type="button" class="btn primary" onClick={countdown.start}>
              {S.chrono.timerAgain}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * État du chronomètre, sauvegardé à chaque action : le temps écoulé se déduit de l'horloge,
 * donc il continue de compter app en arrière-plan, écran verrouillé, ou app fermée puis rouverte.
 */
interface StopwatchMemory {
  running: boolean;
  startedAt: number | null; // Date.now() au dernier départ/reprise
  accumulatedMs: number;
  laps: number[]; // temps écoulé (ms) à chaque tour, le plus récent en premier
}
const STORAGE_KEY = 'cdf-stopwatch';
const memory: StopwatchMemory = { running: false, startedAt: null, accumulatedMs: 0, laps: [] };

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<StopwatchMemory> | null;
  if (saved && typeof saved.accumulatedMs === 'number' && Array.isArray(saved.laps)) {
    memory.running = saved.running === true && typeof saved.startedAt === 'number';
    memory.startedAt = memory.running ? (saved.startedAt as number) : null;
    memory.accumulatedMs = saved.accumulatedMs;
    memory.laps = saved.laps.filter((l): l is number => typeof l === 'number');
  }
} catch {
  // stockage indisponible ou illisible : chronomètre à zéro
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // stockage indisponible : le chrono reste fonctionnel tant que l'app est ouverte
  }
}

function elapsedMs(): number {
  return memory.accumulatedMs + (memory.running && memory.startedAt !== null ? Date.now() - memory.startedAt : 0);
}

function StopwatchCard() {
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const update = () => {
    save();
    bump();
  };

  useEffect(() => {
    if (!memory.running) return;
    const id = setInterval(bump, 100);
    return () => clearInterval(id);
  }, [memory.running]);

  const start = () => {
    memory.running = true;
    memory.startedAt = Date.now();
    update();
  };
  const pause = () => {
    memory.accumulatedMs = elapsedMs();
    memory.running = false;
    memory.startedAt = null;
    update();
  };
  const reset = () => {
    memory.running = false;
    memory.startedAt = null;
    memory.accumulatedMs = 0;
    memory.laps = [];
    update();
  };
  const lap = () => {
    memory.laps = [elapsedMs(), ...memory.laps];
    update();
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
      <StopwatchCard />
      <TimerCard />
    </div>
  );
}
