import { describe, expect, it } from 'vitest';
import { backupsToPrune, fallbackBackupName, isAutoBackupDue } from './autoBackup';

describe('sauvegarde automatique', () => {
  const day = (d: number) => `cycle-de-force-2026-09-${String(d).padStart(2, '0')}.json`;

  it('garde les 14 derniers jours et ignore les autres fichiers', () => {
    const names = [...Array.from({ length: 20 }, (_, i) => day(i + 1)), 'notes.txt', 'cycle-de-force-avant-restauration-2026-09-01.json'];
    expect(backupsToPrune(names, 14)).toEqual([day(6), day(5), day(4), day(3), day(2), day(1)]);
    expect(backupsToPrune(names.slice(0, 3), 14)).toEqual([]);
  });

  it('les copies de secours d’un même jour comptent pour un seul jour', () => {
    const names = [day(3), 'cycle-de-force-2026-09-03-0815.json', day(2), day(1)];
    expect(backupsToPrune(names, 2).sort()).toEqual([day(1)]);
    expect(backupsToPrune(names, 1).sort()).toEqual([day(1), day(2)]);
  });

  it('nom de secours horodaté', () => {
    expect(fallbackBackupName('2026-09-24', new Date(2026, 8, 24, 8, 5))).toBe('cycle-de-force-2026-09-24-0805.json');
  });

  it('pas plus d’une sauvegarde toutes les 2 minutes', () => {
    const t = Date.parse('2026-09-24T10:00:00Z');
    expect(isAutoBackupDue(undefined, t)).toBe(true);
    expect(isAutoBackupDue('2026-09-24T09:59:00Z', t)).toBe(false);
    expect(isAutoBackupDue('2026-09-24T09:57:00Z', t)).toBe(true);
    expect(isAutoBackupDue('pas une date', t)).toBe(true);
  });
});
