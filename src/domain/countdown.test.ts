import { describe, expect, it } from 'vitest';
import {
  addToCountdown,
  countdownPhase,
  idleCountdown,
  pauseCountdown,
  remainingMs,
  resetCountdown,
  setCountdownDuration,
  startCountdown,
} from './countdown';

const T0 = 1_000_000;

describe('minuteur', () => {
  it('décompte depuis la durée choisie puis se termine', () => {
    const c = startCountdown(idleCountdown(90_000), T0);
    expect(countdownPhase(c, T0 + 30_000)).toBe('running');
    expect(remainingMs(c, T0 + 30_000)).toBe(60_000);
    expect(countdownPhase(c, T0 + 90_000)).toBe('done');
    expect(remainingMs(c, T0 + 120_000)).toBe(0);
  });

  it('se met en pause et reprend là où il en était', () => {
    let c = startCountdown(idleCountdown(60_000), T0);
    c = pauseCountdown(c, T0 + 20_000);
    expect(countdownPhase(c, T0 + 500_000)).toBe('paused');
    expect(remainingMs(c, T0 + 500_000)).toBe(40_000);
    c = startCountdown(c, T0 + 500_000);
    expect(remainingMs(c, T0 + 510_000)).toBe(30_000);
  });

  it('ajoute du temps en cours ou en pause, sans passer sous zéro', () => {
    const running = startCountdown(idleCountdown(60_000), T0);
    expect(remainingMs(addToCountdown(running, 30_000, T0 + 10_000), T0 + 10_000)).toBe(80_000);
    expect(remainingMs(addToCountdown(running, -120_000, T0 + 10_000), T0 + 10_000)).toBe(0);
    const paused = pauseCountdown(running, T0 + 10_000);
    expect(remainingMs(addToCountdown(paused, 15_000, T0), T0)).toBe(65_000);
  });

  it('relance la durée choisie une fois terminé, et revient à zéro sur arrêt', () => {
    const done = startCountdown(idleCountdown(30_000), T0);
    const again = startCountdown(done, T0 + 40_000);
    expect(remainingMs(again, T0 + 40_000)).toBe(30_000);
    expect(countdownPhase(resetCountdown(again), T0)).toBe('idle');
    expect(remainingMs(resetCountdown(again), T0)).toBe(30_000);
  });

  it('ne change la durée qu’à l’arrêt, arrondie à la seconde', () => {
    expect(setCountdownDuration(idleCountdown(60_000), 75_400, T0).durationMs).toBe(75_000);
    const running = startCountdown(idleCountdown(60_000), T0);
    expect(setCountdownDuration(running, 10_000, T0 + 1)).toBe(running);
  });
});
