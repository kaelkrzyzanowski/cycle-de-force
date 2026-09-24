import { describe, expect, it } from 'vitest';
import { formatTick, linear, niceTicks } from './scale';

describe('échelles des graphiques', () => {
  it('graduations rondes', () => {
    expect(niceTicks(0, 11_592)).toEqual([0, 5000, 10_000, 15_000]);
    expect(niceTicks(147, 215)).toEqual([140, 160, 180, 200, 220]);
    expect(niceTicks(0, 0)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });
  it('échelle linéaire', () => {
    const x = linear([0, 10], [20, 120]);
    expect(x(0)).toBe(20);
    expect(x(5)).toBe(70);
  });
  it('format compact des grands nombres', () => {
    expect(formatTick(15_000)).toMatch(/^15\sk$/);
    expect(formatTick(2500)).toMatch(/^2\s?500$/);
  });
});
