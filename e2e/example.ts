import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { buildBackup } from '../src/domain/backup';
import { generateCycleSessions } from '../src/domain/cycles';
import { mondayOf, todayIso } from '../src/domain/dates';
import { DEFAULT_SETTINGS } from '../src/domain/types';
import { exampleCycle, exampleProgram } from '../src/fixtures';

/**
 * Sauvegarde du programme d'exemple (5 modèles, et le cycle « Bloc 0 » démarrant cette semaine) :
 * l'app démarre vierge, les tests chargent ces données comme un utilisateur restaurerait les siennes.
 */
export function exampleBackup({ withCycle = true } = {}): string {
  const { templates, exercises } = exampleProgram();
  let n = 0;
  const cycle = exampleCycle('bloc-0', mondayOf(todayIso()));
  const sessions = withCycle ? generateCycleSessions(cycle, new Map(templates.map((t) => [t.id, t])), () => `ex-${++n}`) : [];
  const data = { settings: DEFAULT_SETTINGS, templates, exercises, cycles: withCycle ? [cycle] : [], sessions, maxChanges: [], activities: [] };
  return JSON.stringify(buildBackup(data, new Date().toISOString()));
}

/** Restaure le programme d'exemple depuis Réglages, puis ouvre le calendrier. */
export async function loadExample(page: Page, options: { withCycle?: boolean } = {}) {
  // Navigation dans l'app (lien Réglages) : fonctionne aussi hors ligne, sans recharger la page.
  if (page.url() === 'about:blank') await page.goto('/');
  await page.getByRole('link', { name: 'Réglages', exact: true }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'exemple.json', mimeType: 'application/json', buffer: Buffer.from(exampleBackup(options)) });
  await page.getByRole('dialog').getByRole('button', { name: 'Remplacer toutes mes données' }).click();
  await expect(page.getByRole('status')).toHaveText('Données restaurées');
  await page.getByRole('link', { name: 'Calendrier', exact: true }).click();
}
