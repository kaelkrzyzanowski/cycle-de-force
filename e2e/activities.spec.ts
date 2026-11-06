import { expect, test } from '@playwright/test';

test('ajouter, modifier puis supprimer une activité cardio', async ({ page }) => {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: /^Ajouter le / }).first().click();
  await page.getByRole('button', { name: /Ajouter une activité/ }).click();

  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Vélo').check();
  await sheet.getByLabel('Distance').fill('25');
  await sheet.getByLabel('Minutes').fill('50');
  await sheet.getByLabel('Secondes').fill('0');
  await expect(sheet).toContainText('2 min/km · 30 km/h · 50 min');
  await sheet.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toHaveText('Activité ajoutée');

  const card = page.locator('.session-card', { hasText: 'Vélo' });
  await expect(card).toContainText('25 km · 50 min · 2 min/km · 30 km/h');

  // Modifier : la distance change, l'allure/la vitesse affichées suivent.
  await card.click();
  const editSheet = page.getByRole('dialog');
  await editSheet.getByLabel('Distance').fill('20');
  await expect(editSheet).toContainText('2,5 min/km · 24 km/h · 50 min');
  await editSheet.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toHaveText('Activité mise à jour');
  await expect(card).toContainText('20 km · 50 min · 2,5 min/km · 24 km/h');

  // Supprimer.
  await card.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page.getByRole('status')).toHaveText('Activité supprimée');
  await expect(page.locator('.session-card', { hasText: 'Vélo' })).toHaveCount(0);
});

test('calories : calculées d’après le profil (âge, taille, poids, sexe)', async ({ page }) => {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: /^Ajouter le / }).first().click();
  await page.getByRole('button', { name: /Ajouter une activité/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Vélo').check();
  await sheet.getByLabel('Distance').fill('25');
  await sheet.getByLabel('Minutes').fill('50');
  await sheet.getByLabel('Secondes').fill('0');
  await sheet.getByRole('button', { name: 'Enregistrer' }).click();

  // Sans profil : pas de calories.
  const card = page.locator('.session-card', { hasText: 'Vélo' });
  await expect(card).toBeVisible();
  await expect(card).not.toContainText('kcal');

  await page.goto('/#/reglages');
  await page.getByRole('textbox', { name: 'Âge' }).fill('35');
  await page.getByRole('textbox', { name: 'Âge' }).press('Tab');
  await page.getByRole('textbox', { name: 'Taille' }).fill('180');
  await page.getByRole('textbox', { name: 'Taille' }).press('Tab');
  await page.getByRole('textbox', { name: 'Poids' }).fill('80');
  await page.getByRole('textbox', { name: 'Poids' }).press('Tab');
  await page.getByRole('button', { name: 'Homme' }).click();
  await expect(page.getByRole('button', { name: 'Homme' })).toHaveAttribute('aria-pressed', 'true');

  // 30 km/h à vélo, 50 min, 1 755 kcal/j de base.
  await page.goto('/#/calendrier');
  await expect(card).toContainText(/847\skcal/);
  await page.goto('/#/stats');
  await expect(page.locator('.stat-tile', { hasText: 'Calories' })).toContainText(/847\skcal/);

  await page.goto('/#/activite');
  await expect(page.getByRole('button', { name: 'Démarrer' })).toBeVisible();
});
