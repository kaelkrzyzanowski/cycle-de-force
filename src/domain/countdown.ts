/**
 * Minuteur (compte à rebours). Tout se déduit de l'horloge : l'état reste juste
 * app en arrière-plan, écran verrouillé, ou app fermée puis rouverte.
 */
export interface Countdown {
  /** Durée choisie, en ms. */
  durationMs: number;
  /** Instant de fin (Date.now()) quand il tourne, sinon null. */
  endsAt: number | null;
  /** Temps restant figé quand il est en pause, sinon null. */
  pausedMs: number | null;
}

export type CountdownPhase = 'idle' | 'running' | 'paused' | 'done';

export const COUNTDOWN_PRESETS_SEC: readonly number[] = [30, 60, 90, 120, 180, 300];
export const MAX_COUNTDOWN_MS = 99 * 60_000 + 59_000;

export function idleCountdown(durationMs: number): Countdown {
  return { durationMs, endsAt: null, pausedMs: null };
}

export function countdownPhase(c: Countdown, now: number): CountdownPhase {
  if (c.endsAt !== null) return now >= c.endsAt ? 'done' : 'running';
  return c.pausedMs !== null ? 'paused' : 'idle';
}

export function remainingMs(c: Countdown, now: number): number {
  if (c.endsAt !== null) return Math.max(0, c.endsAt - now);
  return c.pausedMs ?? c.durationMs;
}

/** Démarre (ou reprend) : s'il est terminé, repart de la durée choisie. */
export function startCountdown(c: Countdown, now: number): Countdown {
  const phase = countdownPhase(c, now);
  if (phase === 'running') return c;
  const left = phase === 'paused' ? (c.pausedMs ?? c.durationMs) : c.durationMs;
  return { ...c, endsAt: now + left, pausedMs: null };
}

export function pauseCountdown(c: Countdown, now: number): Countdown {
  if (countdownPhase(c, now) !== 'running') return c;
  return { ...c, endsAt: null, pausedMs: remainingMs(c, now) };
}

export function resetCountdown(c: Countdown): Countdown {
  return idleCountdown(c.durationMs);
}

/** Ajoute (ou retire) du temps à un minuteur en cours ou en pause ; jamais sous zéro. */
export function addToCountdown(c: Countdown, deltaMs: number, now: number): Countdown {
  const phase = countdownPhase(c, now);
  if (phase === 'running') return { ...c, endsAt: Math.max(now, (c.endsAt ?? now) + deltaMs) };
  if (phase === 'paused') return { ...c, pausedMs: Math.max(0, (c.pausedMs ?? 0) + deltaMs) };
  return c;
}

/** Choix de la durée, seulement à l'arrêt. */
export function setCountdownDuration(c: Countdown, durationMs: number, now: number): Countdown {
  if (countdownPhase(c, now) === 'running' || countdownPhase(c, now) === 'paused') return c;
  return idleCountdown(Math.min(MAX_COUNTDOWN_MS, Math.max(0, Math.round(durationMs / 1000) * 1000)));
}
