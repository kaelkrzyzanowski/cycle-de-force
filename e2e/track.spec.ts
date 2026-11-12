import { expect, test } from '@playwright/test';

// Départ près de Notre-Dame ; chaque pas : 20 m vers le nord (1° de latitude ≈ 111,195 km).
const START = { latitude: 48.853, longitude: 2.3499 };
const north = (m: number) => ({ ...START, latitude: START.latitude + m / 111_195, accuracy: 5 });

test.use({ permissions: ['geolocation'], geolocation: north(0) });

test('enregistrer une activité GPS : pause, fin, enregistrement dans le calendrier avec le tracé', async ({ page, context }) => {
  // Pas de tuiles de carte pendant le test.
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/#/aujourdhui');
  await page.getByRole('link', { name: 'Enregistrer une activité GPS' }).click();

  await page.getByRole('button', { name: 'Vélo' }).click();
  await page.getByRole('button', { name: 'Démarrer' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  // 10 positions, une toutes les ~1,1 s : 200 m à vélo (≈ 18 m/s, plausible).
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(1100);
    await context.setGeolocation(north(i * 20));
  }
  await expect(page.locator('.track-metrics')).toContainText(/0,1\d\s*km/, { timeout: 6000 });
  // Vitesse instantanée : 20 m toutes les ~1,1 s, soit environ 65 km/h.
  await expect(page.locator('.track-metrics .is-live')).toContainText(/Vitesse instantanée\s*[4-8]\d(,\d)?\s*km\/h/);

  // En pause, la durée est figée et les déplacements ne comptent pas.
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.locator('.track-status')).toContainText('En pause');
  const frozen = await page.locator('.track-metrics .is-main dd').innerText();
  await context.setGeolocation(north(2000));
  await page.waitForTimeout(2500);
  await expect(page.locator('.track-metrics .is-main dd')).toHaveText(frozen);

  // Le trajet fait en pause ne compte pas.
  await page.getByRole('button', { name: 'Terminer' }).click();
  await page.getByRole('button', { name: 'Terminer' }).last().click();
  await expect(page.getByRole('heading', { name: /Résumé · Vélo/ })).toBeVisible();
  const distance = await page.locator('.track-metrics').innerText();
  expect(distance).not.toMatch(/2,\d+\s*km/);
  await page.getByRole('textbox', { name: 'Note' }).fill('Tour de l’île');
  await page.getByRole('button', { name: 'Enregistrer l’activité' }).click();
  await expect(page.getByRole('status')).toHaveText('Activité enregistrée');
  await expect(page.getByRole('link', { name: 'Enregistrer une activité GPS' })).toBeVisible();

  // Dans le calendrier, l'activité garde son tracé ; le modifier ne le perd pas.
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  await page.locator('.session-card', { hasText: 'Vélo' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('.track-map path[stroke="#e0631f"]')).toHaveCount(1);
  await sheet.getByRole('button', { name: 'Enregistrer' }).click();
  await page.locator('.session-card', { hasText: 'Vélo' }).click();
  await expect(page.getByRole('dialog').locator('.track-map path[stroke="#e0631f"]')).toHaveCount(1);
});

test('activité GPS : un refus de localisation est expliqué', async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await page.goto('/#/activite');
  await page.getByRole('button', { name: 'Démarrer' }).click();
  await expect(page.getByRole('alert')).toContainText('Autorisation de localisation refusée');
  await context.close();
});

test('activité GPS : les calories s’affichent en direct une fois le profil renseigné', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/#/activite');
  await page.getByRole('button', { name: 'Démarrer' }).click();
  await expect(page.locator('.track-metrics')).toContainText('Renseigne ton âge');
  await page.getByRole('link', { name: /Renseigne ton âge/ }).click();

  await page.getByRole('textbox', { name: 'Âge' }).fill('35');
  await page.getByRole('textbox', { name: 'Âge' }).press('Tab');
  await page.getByRole('textbox', { name: 'Taille' }).fill('180');
  await page.getByRole('textbox', { name: 'Taille' }).press('Tab');
  await page.getByRole('textbox', { name: 'Poids' }).fill('80');
  await page.getByRole('textbox', { name: 'Poids' }).press('Tab');

  await page.goto('/#/activite');
  await expect(page.locator('.track-metrics > div', { hasText: 'Calories' }).locator('dd')).toContainText(/\d+\s*kcal/);
});
