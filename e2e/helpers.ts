import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Programme d'origine (5 modèles), généré par scripts/gen-templates-fixture.ts. */
export const ORIGIN_TEMPLATES = fileURLToPath(new URL('./fixtures/modeles-origine.json', import.meta.url));

/**
 * Une installation neuve démarre sans modèle : on importe le programme d'origine par l'écran Modèles,
 * comme le ferait un utilisateur, pour retrouver « Créer le Bloc 0 » dans le calendrier.
 */
export async function importOriginTemplates(page: Page, base = '/'): Promise<void> {
  await page.goto(`${base}#/modeles`);
  await page.locator('input[type="file"][aria-label="Importer des modèles"]').setInputFiles(ORIGIN_TEMPLATES);
  await page.getByRole('dialog').getByRole('button', { name: 'Importer', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('5 modèles importés');
}
