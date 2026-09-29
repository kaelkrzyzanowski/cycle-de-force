import { expect, test } from '@playwright/test';

test('premier lancement vierge : aucun modèle, accueil pour démarrer', async ({ page }) => {
  await page.goto('/#/modeles');
  await expect(page.getByText('Aucun modèle pour l’instant')).toBeVisible();
  await expect(page.locator('.template-row', { has: page.locator('.swatch') })).toHaveCount(0); // hors lien « Exercices et RM »
  await page.goto('/#/calendrier');
  await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
  await page.getByRole('link', { name: 'Créer mon premier modèle' }).click();
  await expect(page.getByRole('button', { name: /Nouveau modèle/ })).toBeVisible();
});

test("l'app est installable et s'ouvre hors ligne", async ({ page, context }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
    return href ? ((await (await fetch(href)).json()) as { name: string; display: string }) : null;
  });
  expect(manifest).toMatchObject({ name: 'HaltèreBook', display: 'standalone' });

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
