import { expect, test } from '@playwright/test';

test('ajouter, modifier puis supprimer une activité cardio', async ({ page }) => {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Actions du calendrier' }).click();
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
