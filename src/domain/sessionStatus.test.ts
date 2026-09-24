import { describe, expect, it } from 'vitest';
import { deriveSessionStatus } from './sessionStatus';
import { fixed, session, set } from './testUtils';
import type { SetStatus } from './types';

const TODAY = '2026-09-24';
const withStatuses = (date: string, ...statuses: SetStatus[]) =>
  session(
    date,
    statuses.map((st, i) => set(i, 5, fixed(100), st)),
  );

describe('deriveSessionStatus', () => {
  it('planifiée si aucune série touchée (aujourd’hui ou futur)', () => {
    expect(deriveSessionStatus(withStatuses(TODAY, 'PLANNED', 'PLANNED'), TODAY)).toBe('PLANNED');
    expect(deriveSessionStatus(withStatuses('2026-10-01', 'PLANNED'), TODAY)).toBe('PLANNED');
  });
  it('manquée si passée et aucune série touchée', () => {
    expect(deriveSessionStatus(withStatuses('2026-09-20', 'PLANNED'), TODAY)).toBe('MISSED');
    expect(deriveSessionStatus(withStatuses('2026-09-20'), TODAY)).toBe('MISSED');
  });
  it('en cours si des séries restent à faire', () => {
    expect(deriveSessionStatus(withStatuses('2026-09-20', 'VALIDATED', 'PLANNED'), TODAY)).toBe('IN_PROGRESS');
  });
  it('échec prioritaire sur incomplète', () => {
    expect(deriveSessionStatus(withStatuses(TODAY, 'VALIDATED', 'FAILED', 'NOT_DONE'), TODAY)).toBe('FAILED');
  });
  it('incomplète si une série non réalisée', () => {
    expect(deriveSessionStatus(withStatuses(TODAY, 'VALIDATED', 'NOT_DONE'), TODAY)).toBe('INCOMPLETE');
  });
  it('validée si tout est validé ou en cluster', () => {
    expect(deriveSessionStatus(withStatuses(TODAY, 'VALIDATED', 'CLUSTER'), TODAY)).toBe('VALIDATED');
  });
});
