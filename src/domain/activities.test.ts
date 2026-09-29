import { describe, expect, it } from 'vitest';
import { averageSpeedKmh, isValidActivity, paceMinPerKm } from './activities';

describe('paceMinPerKm', () => {
  it('calcule les minutes par km', () => {
    expect(paceMinPerKm(10, 3600)).toBe(6); // 10 km en 1h = 6 min/km
  });

  it('renvoie null sans distance', () => {
    expect(paceMinPerKm(0, 3600)).toBeNull();
    expect(paceMinPerKm(-1, 3600)).toBeNull();
  });
});

describe('averageSpeedKmh', () => {
  it('calcule la vitesse moyenne', () => {
    expect(averageSpeedKmh(10, 3600)).toBe(10); // 10 km en 1h = 10 km/h
  });

  it('renvoie null sans durée', () => {
    expect(averageSpeedKmh(10, 0)).toBeNull();
    expect(averageSpeedKmh(10, -1)).toBeNull();
  });
});

describe('isValidActivity', () => {
  it('accepte une distance et une durée strictement positives', () => {
    expect(isValidActivity(8.4, 2520)).toBe(true);
  });

  it('refuse une distance ou une durée nulle, négative, ou non finie', () => {
    expect(isValidActivity(0, 60)).toBe(false);
    expect(isValidActivity(5, 0)).toBe(false);
    expect(isValidActivity(-5, 60)).toBe(false);
    expect(isValidActivity(5, -60)).toBe(false);
    expect(isValidActivity(NaN, 60)).toBe(false);
    expect(isValidActivity(Infinity, 60)).toBe(false);
  });

  it('refuse une durée non entière', () => {
    expect(isValidActivity(5, 60.5)).toBe(false);
  });
});
