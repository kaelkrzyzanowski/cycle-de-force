import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isoWeekday, mondayOf, todayIso } from './dates';

describe('dates', () => {
  it('jour de la semaine ISO (lundi = 1)', () => {
    expect(isoWeekday('2026-09-21')).toBe(1);
    expect(isoWeekday('2026-09-27')).toBe(7);
  });
  it('lundi de la semaine', () => {
    expect(mondayOf('2026-09-24')).toBe('2026-09-21');
    expect(mondayOf('2026-09-27')).toBe('2026-09-21');
    expect(mondayOf('2026-09-21')).toBe('2026-09-21');
  });
  it('ajout de jours à travers les mois et le changement d’heure', () => {
    expect(addDays('2026-09-28', 7)).toBe('2026-10-05');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(daysBetween('2026-09-21', '2026-11-09')).toBe(49);
  });
  it('date locale du jour', () => {
    expect(todayIso(new Date(2026, 8, 24, 23, 30))).toBe('2026-09-24');
  });
});
