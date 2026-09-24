import { expect, test } from '@playwright/test';

test('les 5 modèles natifs sont chargés au premier lancement', async ({ page }) => {
  await page.goto('/#/modeles');
  for (const name of ['Deadlift', 'SBD', 'Bench', 'Squat', 'Joker']) {
    await expect(page.locator('.template-row .name', { hasText: new RegExp(`^${name}`) })).toBeVisible();
  }
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
  await expect(page.getByRole('listitem').filter({ hasText: /^Deadlift/ })).toBeVisible();
  await page.getByRole('link', { name: 'Réglages' }).click();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
});
