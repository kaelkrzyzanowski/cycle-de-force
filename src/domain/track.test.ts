import { describe, expect, it } from 'vitest';
import { acceptPoint, elapsedMs, haversineM, newClock, pauseClock, resumeClock, simplifyTrack, trackDistanceKm } from './track';
import type { TrackPoint } from './types';

/** Point à `northM` mètres au nord de l'origine (1° de latitude ≈ 111,195 km). */
const north = (northM: number, t: number, seg = 0): TrackPoint => ({ lat: 48 + northM / 111_195, lon: 2, t, seg });

describe('distance GPS', () => {
  it('haversine : 1° de latitude ≈ 111,2 km, Paris – Lyon ≈ 391,5 km', () => {
    expect(haversineM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111_195, -1);
    expect(haversineM({ lat: 48.8566, lon: 2.3522 }, { lat: 45.764, lon: 4.8357 }) / 1000).toBeCloseTo(391.5, 0);
  });

  it('additionne les segments sans compter le trajet pendant la pause', () => {
    const points = [north(0, 0), north(500, 150_000), north(1000, 300_000), north(3000, 900_000, 1), north(3500, 1_050_000, 1)];
    expect(trackDistanceKm(points)).toBeCloseTo(1.5, 2);
    expect(trackDistanceKm([])).toBe(0);
  });
});

describe('filtrage des points', () => {
  it('écarte les points imprécis et les sauts impossibles pour le sport', () => {
    const a = north(0, 0);
    expect(acceptPoint(undefined, a, 10, 'RUNNING')).toBe(true);
    expect(acceptPoint(undefined, a, 80, 'RUNNING')).toBe(false);
    expect(acceptPoint(a, north(30, 10_000), 10, 'RUNNING')).toBe(true); // 3 m/s
    expect(acceptPoint(a, north(300, 10_000), 10, 'RUNNING')).toBe(false); // 30 m/s à pied
    expect(acceptPoint(a, north(200, 10_000), 10, 'CYCLING')).toBe(true); // 20 m/s à vélo
    expect(acceptPoint(a, north(300, 10_000, 1), 10, 'RUNNING')).toBe(true); // reprise après pause
  });

  it('simplifie le tracé en gardant les extrémités de segment', () => {
    const dense = Array.from({ length: 11 }, (_, i) => north(i, i * 1000));
    const kept = simplifyTrack(dense, 4.5);
    expect(kept.map((p) => Math.round((p.lat - 48) * 111_195))).toEqual([0, 5, 10]);
  });
});

describe('chronomètre d’activité', () => {
  it('exclut les pauses', () => {
    let c = newClock(0);
    c = pauseClock(c, 60_000);
    expect(elapsedMs(c, 600_000)).toBe(60_000);
    c = resumeClock(c, 600_000);
    expect(elapsedMs(c, 630_000)).toBe(90_000);
  });
});
