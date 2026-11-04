import { useEffect, useState } from 'preact/hooks';
import {
  addToCountdown,
  countdownPhase,
  idleCountdown,
  pauseCountdown,
  resetCountdown,
  setCountdownDuration,
  startCountdown,
} from '../domain/countdown';
import type { Countdown } from '../domain/countdown';
import { isNative, loadNative } from '../platform';
import { S } from './strings';

/**
 * État du minuteur, partagé par toute l'app : il continue de décompter quand on change d'onglet,
 * et sonne même si l'écran Chrono n'est pas ouvert. Sauvegardé à chaque action.
 */
const STORAGE_KEY = 'cdf-countdown';
/** Au-delà de ce retard, l'app était suspendue à la fin : la notification Android a déjà sonné. */
const LATE_MS = 3000;

let state: Countdown = load();
const listeners = new Set<() => void>();
const doneListeners = new Set<() => void>();
let finishTimer: number | undefined;
let audio: AudioContext | undefined;

function load(): Countdown {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Countdown> | null;
    if (saved && typeof saved.durationMs === 'number') {
      return {
        durationMs: saved.durationMs,
        endsAt: typeof saved.endsAt === 'number' ? saved.endsAt : null,
        pausedMs: typeof saved.pausedMs === 'number' ? saved.pausedMs : null,
      };
    }
  } catch {
    // stockage indisponible ou illisible
  }
  return idleCountdown(90_000);
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // le minuteur reste fonctionnel tant que l'app est ouverte
  }
}

function unlockAudio(): void {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    // pas de son disponible
  }
}

function beep(): void {
  try {
    unlockAudio();
    if (!audio) return;
    const t0 = audio.currentTime + 0.05;
    for (let i = 0; i < 3; i++) {
      const start = t0 + i * 0.45;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.35);
    }
  } catch {
    // pas de son disponible
  }
}

function armFinish(): void {
  window.clearTimeout(finishTimer);
  const endsAt = state.endsAt;
  if (endsAt === null || endsAt <= Date.now()) return;
  finishTimer = window.setTimeout(() => {
    listeners.forEach((fn) => fn());
    if (Date.now() - endsAt > LATE_MS) return;
    beep();
    navigator.vibrate?.([400, 200, 400, 200, 400]);
    doneListeners.forEach((fn) => fn());
  }, endsAt - Date.now());
}

function set(next: Countdown): void {
  state = next;
  save();
  armFinish();
  listeners.forEach((fn) => fn());
}

armFinish();

export const countdown = {
  get: (): Countdown => state,
  start(): void {
    unlockAudio();
    if (isNative) void loadNative().then((native) => native.ensureNotificationPermission());
    set(startCountdown(state, Date.now()));
  },
  pause: (): void => set(pauseCountdown(state, Date.now())),
  reset: (): void => set(resetCountdown(state)),
  add: (deltaMs: number): void => set(addToCountdown(state, deltaMs, Date.now())),
  setDuration: (ms: number): void => set(setCountdownDuration(state, ms, Date.now())),
  /** Appelé quand le minuteur sonne pendant que l'app est ouverte. */
  onDone(fn: () => void): () => void {
    doneListeners.add(fn);
    return () => doneListeners.delete(fn);
  },
};

/**
 * App Android : en arrière-plan, Android prend le relais et sonne à l'heure par une notification ;
 * au retour au premier plan, l'app reprend la main (et annule la notification programmée).
 */
export function installCountdownAlarm(): void {
  if (!isNative) return;
  void loadNative().then((native) => {
    void native.cancelTimerAlarm();
    native.onAppStateChange((active) => {
      if (active) {
        void native.cancelTimerAlarm();
      } else if (state.endsAt !== null && state.endsAt > Date.now()) {
        void native.scheduleTimerAlarm(state.endsAt, S.chrono.timerDone, S.chrono.timerDoneBody);
      }
    });
  });
}

/** État courant, rafraîchi à chaque action et toutes les 250 ms tant qu'il décompte. */
export function useCountdown(): Countdown {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  const running = countdownPhase(state, Date.now()) === 'running';
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [running]);
  return state;
}
