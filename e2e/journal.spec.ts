import { expect, test } from '@playwright/test';

test('journal calorique : aliment de la table (cuit, en grammes), aliment libre, aliment personnalisé', async ({ page }) => {
  await page.goto('/#/journal');
  await expect(page.locator('.kcal-status')).toHaveText('Aucune saisie');

  // Midi : 150 g de riz blanc cuit = 195 kcal.
  const midi = page.locator('.meal-card', { has: page.getByRole('heading', { name: 'Midi' }) });
  await midi.getByRole('button', { name: /Ajouter un aliment/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('textbox', { name: 'Rechercher un aliment' }).fill('riz bl');
  await sheet.getByRole('button', { name: /^Riz blanc/ }).click();
  await sheet.getByRole('button', { name: /^Cuit/ }).click();
  await sheet.getByRole('textbox', { name: 'Poids' }).fill('150');
  await sheet.getByRole('textbox', { name: 'Poids' }).press('Tab');
  await expect(sheet.locator('.food-total')).toHaveText(/195\skcal/);
  await sheet.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(midi).toContainText(/Riz blanc.*150 g · cuit/);

  // Soir : aliment libre à 650 kcal.
  const soir = page.locator('.meal-card', { has: page.getByRole('heading', { name: 'Soir' }) });
  await soir.getByRole('button', { name: /Ajouter un aliment/ }).click();
  await sheet.getByRole('button', { name: /Aliment libre/ }).click();
  await sheet.getByRole('textbox', { name: 'Nom de l’aliment' }).fill('Pizza');
  await sheet.getByRole('textbox', { name: 'Calories' }).fill('650');
  await sheet.getByRole('textbox', { name: 'Calories' }).press('Tab');
  await sheet.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('.kcal-status')).toHaveText(/1\s?155\skcal restantes/); // 2000 − 845

  // Objectif dépassé : 800 → au-delà.
  await page.getByRole('textbox', { name: 'Objectif par jour' }).fill('800');
  await page.getByRole('textbox', { name: 'Objectif par jour' }).press('Tab');
  await expect(page.locator('.kcal-status')).toHaveText(/45\skcal au-delà/);

  // Modifier puis supprimer une ligne.
  await soir.getByRole('button', { name: /Pizza/ }).click();
  await sheet.getByRole('button', { name: 'Supprimer' }).click();
  await expect(soir).not.toContainText('Pizza');

  // Aliment personnalisé, retrouvé dans la recherche.
  await page.getByText('Mes aliments personnalisés').click();
  const custom = page.locator('.custom-foods');
  await custom.getByRole('textbox', { name: 'Nom de l’aliment' }).fill('Galette de sarrasin');
  await custom.getByRole('combobox', { name: 'Catégorie' }).selectOption('feculents');
  await custom.getByRole('textbox', { name: 'Calories pour 100 g (cru)' }).fill('200');
  await custom.getByRole('textbox', { name: 'Calories pour 100 g (cru)' }).press('Tab');
  await custom.getByRole('button', { name: 'Ajouter à ma liste' }).click();
  await expect(page.getByRole('status')).toContainText('Galette de sarrasin');
  const matin = page.locator('.meal-card', { has: page.getByRole('heading', { name: 'Matin' }) });
  await matin.getByRole('button', { name: /Ajouter un aliment/ }).click();
  await sheet.getByRole('textbox', { name: 'Rechercher un aliment' }).fill('sarrasin');
  await expect(sheet.getByRole('button', { name: /Galette de sarrasin/ })).toBeVisible();
  await page.keyboard.press('Escape');

  // Persistance et stats.
  await page.reload();
  await expect(midi).toContainText('Riz blanc');
  await expect(page.locator('.stat-tile', { hasText: 'Jours suivis' })).toContainText('1');
  await expect(page.locator('.stat-tile', { hasText: 'Moyenne' })).toContainText(/195\skcal/);
  await expect(page.locator('.kcal-heatmap .heat-cell.is-good')).toHaveCount(1);
});
