import { describe, expect, it } from 'vitest';
import { acceptPoint, elapsedMs, elevationGainM, haversineM, instantSpeedKmh, newClock, pauseClock, resumeClock, simplifyTrack, trackDistanceKm } from './track';
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

describe('vitesse instantanée', () => {
  it('sur les 10 dernières secondes du segment en cours', () => {
    // 5 m/s pendant 20 s, puis 2,5 m/s sur les 10 dernières : 9 km/h.
    const points = [
      ...Array.from({ length: 21 }, (_, i) => north(i * 5, i * 1000)),
      ...Array.from({ length: 10 }, (_, i) => north(100 + (i + 1) * 2.5, 21_000 + i * 1000)),
    ];
    expect(instantSpeedKmh(points, 30_000)).toBeCloseTo(9, 0);
  });

  it('rien sans signal récent, au tout début, ou juste après une reprise', () => {
    expect(instantSpeedKmh([], 0)).toBeNull();
    expect(instantSpeedKmh([north(0, 0), north(5, 1000)], 1000)).toBeNull(); // 1 s : trop court
    expect(instantSpeedKmh([north(0, 0), north(20, 4000)], 20_000)).toBeNull(); // dernier point trop ancien
    expect(instantSpeedKmh([north(0, 0), north(50, 5000), north(500, 60_000, 1)], 60_000)).toBeNull(); // segment repris
  });
});

describe('dénivelé positif', () => {
  const at = (alt: number, i: number, seg = 0): TrackPoint => ({ ...north(i * 10, i * 1000, seg), alt });

  it('compte les montées, pas les descentes ni le bruit du GPS', () => {
    // Montée régulière de 100 à 150 m, redescente à 120 m, puis remontée à 140 m : 50 + 20 = 70 m.
    const alts = [...Array.from({ length: 51 }, (_, i) => 100 + i), ...Array.from({ length: 30 }, (_, i) => 149 - i), ...Array.from({ length: 21 }, (_, i) => 120 + i)];
    expect(elevationGainM(alts.map((a, i) => at(a, i)))).toBeCloseTo(70, -1);
    // Plat avec ± 2 m de bruit : rien.
    expect(elevationGainM(Array.from({ length: 60 }, (_, i) => at(200 + (i % 2 ? 2 : -2), i)))).toBe(0);
  });

  it('pas d’altitude : null ; la pause ne crée pas de montée', () => {
    expect(elevationGainM([north(0, 0), north(10, 1000)])).toBeNull();
    const before = Array.from({ length: 10 }, (_, i) => at(100, i));
    const after = Array.from({ length: 10 }, (_, i) => at(300, 20 + i, 1));
    expect(elevationGainM([...before, ...after])).toBe(0);
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
