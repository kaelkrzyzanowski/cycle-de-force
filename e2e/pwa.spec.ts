import { expect, test } from '@playwright/test';
import { importOriginTemplates, ORIGIN_TEMPLATES } from './helpers';

test('premier lancement : aucun modèle ni cycle, catalogue d’exercices classé ; import du programme d’origine', async ({ page }) => {
  await page.goto('/#/calendrier');
  await expect(page.getByRole('link', { name: 'Créer mes modèles' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer le Bloc 0' })).toHaveCount(0);

  await page.goto('/#/modeles');
  await expect(page.locator('.template-row')).toHaveCount(0);
  await expect(page.getByText('Aucun modèle pour l’instant')).toBeVisible();

  await importOriginTemplates(page);
  for (const name of ['Deadlift', 'SBD', 'Bench', 'Squat', 'Joker']) {
    await expect(page.locator('.template-row .name', { hasText: new RegExp(`^${name}`) })).toBeVisible();
  }
  // Un second import n'ajoute ni ne remplace rien.
  await page.locator('input[type="file"][aria-label="Importer des modèles"]').setInputFiles(ORIGIN_TEMPLATES);
  await expect(page.getByRole('dialog')).toContainText('Tous les modèles de ce fichier sont déjà présents');
});

test("l'app est installable et s'ouvre hors ligne", async ({ page, context }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
    return href ? ((await (await fetch(href)).json()) as { name: string; display: string }) : null;
  });
  expect(manifest).toMatchObject({ name: 'Cycle de force', display: 'standalone' });

  // Attendre que le service worker contrôle la page (précache terminé).
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.goto('/#/modeles');
  await page.reload();
  await expect(page.getByText('Aucun modèle pour l’instant')).toBeVisible();
  await page.getByRole('link', { name: 'Réglages' }).click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
});
