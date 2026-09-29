import { useEffect, useState } from 'preact/hooks';
import { adjustTimer, pauseTimer, presetTimer, remainingMs, resetTimer, startTimer, tickTimer } from '../domain/timer';
import type { TimerState } from '../domain/timer';

/**
 * Minuteur unique de l'app : il vit hors des écrans pour continuer (et sonner) quand on quitte
 * l'onglet Chrono, par exemple pour valider ses séries pendant la récupération.
 */
let state: TimerState = { phase: 'idle', durationMs: 90_000 };
const listeners = new Set<() => void>();
let loop: number | undefined;
let lastCountdownBeep: number | null = null;

// ——— Son (Web Audio : aucun fichier à embarquer) ———

let audio: AudioContext | null = null;

/** À appeler lors d'un geste de l'utilisateur : les navigateurs n'autorisent le son qu'après. */
function unlockAudio(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null; // pas de Web Audio : la vibration reste
  }
}

function tone(freq: number, at: number, duration: number, volume: number): void {
  if (!audio) return;
  const t = audio.currentTime + at;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  // Attaque et relâche courtes : un bip net, sans claquement.
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.01);
  gain.gain.setValueAtTime(volume, t + duration - 0.03);
  gain.gain.linearRampToValueAtTime(0, t + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + duration);
}

/** Bips courts des 3 dernières secondes. */
function countdownBeep(): void {
  tone(660, 0, 0.12, 0.15);
}

/** Fin du minuteur : trois doubles bips aigus et une vibration longue. */
function alarm(): void {
  for (let i = 0; i < 3; i++) {
    tone(880, i * 0.6, 0.18, 0.25);
    tone(1320, i * 0.6 + 0.22, 0.22, 0.25);
  }
  navigator.vibrate?.([400, 150, 400, 150, 800]);
}

// ——— Boucle ———

function notify(): void {
  for (const l of listeners) l();
}

function step(): void {
  if (state.phase !== 'running') return;
  const now = Date.now();
  const sec = Math.ceil(remainingMs(state, now) / 1000);
  if (sec >= 1 && sec <= 3 && sec !== lastCountdownBeep) {
    lastCountdownBeep = sec;
    countdownBeep();
  }
  const next = tickTimer(state, now);
  if (next !== state) {
    alarm();
    set(next);
  } else notify();
}

function set(next: TimerState): void {
  state = next;
  lastCountdownBeep = null;
  if (state.phase === 'running' && loop === undefined) loop = window.setInterval(step, 200);
  if (state.phase !== 'running' && loop !== undefined) {
    window.clearInterval(loop);
    loop = undefined;
  }
  notify();
}

// Au retour d'arrière-plan (intervalles ralentis), rattraper tout de suite : sonner si c'est fini.
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', step);

export const timer = {
  start(): void {
    unlockAudio();
    set(startTimer(state, Date.now()));
  },
  pause(): void {
    set(pauseTimer(state, Date.now()));
  },
  reset(): void {
    set(resetTimer(state));
  },
  preset(durationMs: number): void {
    unlockAudio();
    set(presetTimer(durationMs, Date.now()));
  },
  adjust(deltaMs: number): void {
    set(adjustTimer(state, deltaMs, Date.now()));
  },
};

/** État du minuteur et temps restant, rafraîchis à chaque pas de la boucle. */
export function useTimer(): { state: TimerState; remainingMs: number } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  return { state, remainingMs: remainingMs(state, Date.now()) };
}
