/**
 * Minuteur (compte à rebours), en fonctions pures du temps `now` (ms, Date.now()) : l'écran peut
 * être recalculé à tout moment, y compris au retour d'arrière-plan quand les intervalles ont été ralentis.
 */
export type TimerState =
  | { phase: 'idle'; durationMs: number }
  | { phase: 'running'; durationMs: number; endsAt: number }
  | { phase: 'paused'; durationMs: number; remainingMs: number }
  | { phase: 'done'; durationMs: number };

export const TIMER_MIN_MS = 5_000;
export const TIMER_MAX_MS = 99 * 60_000;

const clamp = (ms: number): number => Math.min(TIMER_MAX_MS, Math.max(TIMER_MIN_MS, Math.round(ms / 1000) * 1000));

export function remainingMs(s: TimerState, now: number): number {
  switch (s.phase) {
    case 'idle':
      return s.durationMs;
    case 'running':
      return Math.max(0, s.endsAt - now);
    case 'paused':
      return s.remainingMs;
    case 'done':
      return 0;
  }
}

/** Démarre (depuis le début) ou reprend après une pause. */
export function startTimer(s: TimerState, now: number): TimerState {
  switch (s.phase) {
    case 'idle':
    case 'done':
      return { phase: 'running', durationMs: s.durationMs, endsAt: now + s.durationMs };
    case 'paused':
      return { phase: 'running', durationMs: s.durationMs, endsAt: now + s.remainingMs };
    case 'running':
      return s;
  }
}

export function pauseTimer(s: TimerState, now: number): TimerState {
  return s.phase === 'running' ? { phase: 'paused', durationMs: s.durationMs, remainingMs: remainingMs(s, now) } : s;
}

/** Retour à la durée choisie, arrêté. */
export function resetTimer(s: TimerState): TimerState {
  return { phase: 'idle', durationMs: s.durationMs };
}

/** Durée rapide (repos de 1:30…) : la choisit et lance le compte à rebours aussitôt. */
export function presetTimer(durationMs: number, now: number): TimerState {
  return startTimer({ phase: 'idle', durationMs: clamp(durationMs) }, now);
}

/**
 * ±15 s : change la durée à l'arrêt, ou le temps restant en cours / en pause (sans descendre sous 1 s :
 * pour arrêter, il y a « Réinitialiser »).
 */
export function adjustTimer(s: TimerState, deltaMs: number, now: number): TimerState {
  switch (s.phase) {
    case 'idle':
    case 'done':
      return { phase: 'idle', durationMs: clamp(s.durationMs + deltaMs) };
    case 'running':
      return { ...s, endsAt: Math.max(now + 1000, Math.min(now + TIMER_MAX_MS, s.endsAt + deltaMs)) };
    case 'paused':
      return { ...s, remainingMs: Math.max(1000, Math.min(TIMER_MAX_MS, s.remainingMs + deltaMs)) };
  }
}

/** Fait passer un minuteur arrivé à zéro en « terminé » (moment de sonner). */
export function tickTimer(s: TimerState, now: number): TimerState {
  return s.phase === 'running' && now >= s.endsAt ? { phase: 'done', durationMs: s.durationMs } : s;
}
