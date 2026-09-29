import { useEffect, useState } from 'preact/hooks';
import { capitalize, formatStopwatch } from '../format';
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
      <StopwatchCard />
    </div>
  );
}
