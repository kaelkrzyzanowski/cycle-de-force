import { describe, expect, it } from 'vitest';
import { adjustTimer, pauseTimer, presetTimer, remainingMs, resetTimer, startTimer, tickTimer } from './timer';
import type { TimerState } from './timer';

const idle: TimerState = { phase: 'idle', durationMs: 90_000 };

describe('minuteur', () => {
  it('compte à rebours, pause, reprise, puis terminé', () => {
    let s = startTimer(idle, 0);
    expect(remainingMs(s, 30_000)).toBe(60_000);
    s = pauseTimer(s, 30_000);
    expect(remainingMs(s, 500_000)).toBe(60_000); // le temps ne file pas en pause
    s = startTimer(s, 100_000);
    expect(tickTimer(s, 159_999).phase).toBe('running');
    s = tickTimer(s, 160_000);
    expect(s).toEqual({ phase: 'done', durationMs: 90_000 });
    expect(remainingMs(s, 170_000)).toBe(0);
  });

  it('se recalcule sur l’horloge : un retour tardif (arrière-plan) passe directement à terminé', () => {
    const s = startTimer(idle, 0);
    expect(tickTimer(s, 10 * 60_000).phase).toBe('done');
  });

  it('durée rapide : choisie et lancée d’un geste', () => {
    expect(presetTimer(120_000, 1_000)).toEqual({ phase: 'running', durationMs: 120_000, endsAt: 121_000 });
  });

  it('±15 s : sur la durée à l’arrêt, sur le restant en cours, avec des bornes', () => {
    expect(adjustTimer(idle, 15_000, 0)).toEqual({ phase: 'idle', durationMs: 105_000 });
    expect(adjustTimer({ phase: 'idle', durationMs: 10_000 }, -15_000, 0)).toEqual({ phase: 'idle', durationMs: 5_000 });
    const running = startTimer(idle, 0);
    expect(remainingMs(adjustTimer(running, 15_000, 10_000), 10_000)).toBe(95_000);
    expect(remainingMs(adjustTimer(running, -15_000, 85_000), 85_000)).toBe(1_000);
    expect(adjustTimer({ phase: 'paused', durationMs: 90_000, remainingMs: 20_000 }, -15_000, 0)).toMatchObject({ remainingMs: 5_000 });
  });

  it('réinitialiser garde la durée choisie', () => {
    expect(resetTimer(startTimer(idle, 0))).toEqual(idle);
  });
});
