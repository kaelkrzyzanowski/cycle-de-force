import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

/** Charge l'app en ligne une fois, attend que le service worker la contrôle, puis coupe le réseau. */
async function goOffline(page: Page, context: BrowserContext, url = '/') {
  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
}

test('séance complète en mode avion', async ({ page, context }) => {
  await goOffline(page, context);
  await page.reload(); // démarrage à froid sans réseau
  await page.getByRole('button', { name: 'Créer le Bloc 0' }).click();
  await expect(page.getByRole('status')).toHaveText('Bloc 0 créé : 28 séances');
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  await page.locator('.session-card-main', { has: page.locator('.session-name', { hasText: /^Deadlift S\d$/ }) }).click();

  // Tout valider, sauf une série lourde en échec, avec RIR et notes.
  const validateAll = page.getByRole('button', { name: /Tout valider/ });
  await expect(validateAll.first()).toBeVisible();
  for (let n = await validateAll.count(); n > 0; n--) {
    await validateAll.first().click();
    await expect(validateAll).toHaveCount(n - 1);
  }
  const heavy = page.locator('.exercise-card', { has: page.getByRole('heading', { name: 'Deadlift Sumo + Inche mur' }) });
  await heavy.locator('.set-pill').nth(3).click({ delay: 700 });
  await page.getByRole('textbox', { name: 'Reps réalisées' }).fill('3');
  await page.getByRole('dialog').getByRole('button', { name: /Échec/ }).click();
  await heavy.getByRole('group', { name: /RIR/ }).getByRole('button', { name: '0' }).click();
  await heavy.getByRole('textbox', { name: /Note/ }).fill('Dernière série lâchée');
  await heavy.getByRole('textbox', { name: /Note/ }).press('Tab');
  await page.getByRole('textbox', { name: 'Note de séance' }).fill('Séance en mode avion');
  await page.getByRole('textbox', { name: 'Note de séance' }).press('Tab');
  await expect(page.locator('.totals-bar')).toContainText(/11\s?256\skg/); // 11 592 − 2 reps × 168

  // Toujours hors ligne : tout est encore là après un redémarrage.
  await page.reload();
  await expect(heavy.locator('.set-pill').nth(3)).toHaveClass(/st-FAILED/);
  await expect(heavy.getByRole('button', { name: '0', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(heavy.getByRole('textbox', { name: /Note/ })).toHaveValue('Dernière série lâchée');
  await expect(page.getByRole('textbox', { name: 'Note de séance' })).toHaveValue('Séance en mode avion');
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  const card = page.locator('.session-card', { has: page.locator('.session-name', { hasText: /^Deadlift S\d$/ }) });
  await expect(card).toHaveClass(/st-FAILED/);
});

test('installable selon Chrome : aucune erreur de manifeste ni d’installabilité', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await page.context().newCDPSession(page);
  const manifest = (await cdp.send('Page.getAppManifest')) as { errors: { message: string }[]; url: string };
  expect(manifest.errors).toEqual([]);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: unknown[] };
  expect(installabilityErrors).toEqual([]);
});

test('même build servie dans un sous-dossier (type GitHub Pages), hors ligne', async ({ page, context }) => {
  const base = 'http://localhost:4175/cycle-de-force/';
  await goOffline(page, context, base);
  await page.goto(`${base}#/modeles`);
  await expect(page.getByRole('listitem').filter({ hasText: /^Deadlift/ })).toBeVisible();
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe(base);
});
