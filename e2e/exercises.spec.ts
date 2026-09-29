import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mondayOf, todayIso } from '../src/domain/dates';

async function setNumber(page: Page, label: string, value: string) {
  const field = page.getByRole('textbox', { name: label, exact: true });
  await field.fill(value);
  await field.press('Enter');
}

test('RM sur un nouvel exercice : réglé dans l’éditeur, repris par le cycle, suivi dans « Exercices et RM »', async ({ page }) => {
  // Nouveau modèle, nouvel exercice, série en % : le RM se choisit et se règle sur place.
  await page.goto('/#/modeles');
  await page.getByRole('button', { name: /Nouveau modèle/ }).click();
  await page.getByLabel('Nom du modèle').fill('Jambes');
  await setNumber(page, 'Nombre de semaines', '1');
  await page.getByRole('button', { name: 'Créer le modèle' }).click();
  await page.getByRole('combobox', { name: 'Nom du nouvel exercice' }).fill('Presse à cuisses');
  await page.getByRole('button', { name: /Ajouter un exercice/ }).click();
  await page.getByRole('combobox', { name: 'Type de charge série 1' }).selectOption('PERCENT');
  await expect(page.getByRole('combobox', { name: 'Mouvement série 1' })).toHaveValue('presse-a-cuisses');
  await expect(page.getByRole('combobox', { name: 'Mouvement série 1' }).locator('option:checked')).toHaveText('Presse à cuisses');
  await expect(page.getByText('RM à renseigner')).toBeVisible();
  await setNumber(page, 'RM Presse à cuisses', '200');
  await expect(page.getByText('RM à renseigner')).toHaveCount(0);
  await setNumber(page, 'Valeur de charge série 1', '70');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toHaveText('Modèle enregistré');

  // L'écran « Exercices et RM » le montre.
  await page.goto('/#/modeles');
  await page.getByRole('link', { name: /Exercices et RM/ }).click();
  await expect(page.getByRole('button', { name: /Presse à cuisses/ })).toContainText('RM 200 kg');

  // Nouveau cycle : le RM de l'exercice est prérempli ; la séance calcule 70 % de 200.
  await page.goto('/#/cycle/nouveau');
  await page.getByLabel('Nom du cycle').fill('Bloc jambes');
  await page.getByLabel('Date de début').fill(mondayOf(todayIso()));
  await setNumber(page, 'Nombre de semaines', '1');
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByLabel('Lundi').selectOption({ label: 'Jambes' });
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.getByRole('textbox', { name: 'Presse à cuisses', exact: true })).toHaveValue('200');
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Créer' }).click();
  await page.goto(`/#/calendrier`);
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  await page.locator('.session-card-main', { hasText: 'Jambes' }).click();
  await expect(page.locator('.set-pill').first()).toContainText('8 × 140 kg');
  await expect(page.locator('.set-pill').first()).toContainText(/70\s%\sPresse à cuisses/);

  // Renommer + abréviation depuis « Exercices et RM » : le nom suit partout.
  await page.goto('/#/exercices');
  await page.getByRole('button', { name: /Presse à cuisses/ }).click();
  await page.getByRole('dialog').getByLabel('Nom').fill('Presse');
  await page.getByRole('dialog').getByLabel('Abréviation (facultatif)').fill('P');
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toHaveText('Exercice enregistré');
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  await page.locator('.session-card-main', { hasText: 'Jambes' }).click();
  await expect(page.getByRole('heading', { name: 'Presse', exact: true })).toBeVisible();
  await expect(page.locator('.set-pill').first()).toContainText(/70\s%\sP$/);
});

test('créer un exercice avec son RM depuis « Exercices et RM »', async ({ page }) => {
  await page.goto('/#/exercices');
  await page.getByRole('button', { name: /Nouvel exercice/ }).click();
  await page.getByRole('dialog').getByLabel('Nom').fill('Squat');
  await setNumber(page, 'RM actuel', '150');
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toHaveText('Exercice « Squat » créé');
  await expect(page.getByRole('button', { name: /Squat/ })).toContainText('RM 150 kg');
});
