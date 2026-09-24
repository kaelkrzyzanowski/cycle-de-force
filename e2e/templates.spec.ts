import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mondayOf, todayIso } from '../src/domain/dates';

const monday = mondayOf(todayIso());

async function setNumber(page: Page, label: string, value: string) {
  const field = page.getByRole('textbox', { name: label, exact: true });
  await field.fill(value);
  await field.press('Enter');
}

test('créer « Bench volume » sur 4 semaines, progression 65 → 80 %, et l’utiliser dans un nouveau cycle', async ({ page }) => {
  await page.goto('/#/modeles');
  await page.getByRole('button', { name: /Nouveau modèle/ }).click();
  await page.getByLabel('Nom du modèle').fill('Bench volume');
  await setNumber(page, 'Nombre de semaines', '4');
  await page.getByRole('button', { name: 'Créer le modèle' }).click();
  await expect(page.getByRole('tab')).toHaveText(['Sem. 1', 'Sem. 2', 'Sem. 3', 'Sem. 4']);

  // Semaine 1 : Développé couché 4 × 8.
  await page.getByRole('combobox', { name: 'Nom du nouvel exercice' }).fill('Développé couché');
  await page.getByRole('button', { name: /Ajouter un exercice/ }).click();
  await page.getByRole('button', { name: /Ajouter une série/ }).click();
  await expect(page.getByRole('textbox', { name: /^Reps série/ })).toHaveCount(4);

  // Copier S1 vers toutes les semaines.
  await page.getByRole('button', { name: /Copier la semaine 1 vers/ }).click();
  await page.getByRole('dialog').getByLabel('Toutes').check();
  await page.getByRole('dialog').getByRole('button', { name: 'Copier' }).click();
  await expect(page.getByRole('status')).toHaveText('Semaine 1 copiée vers 3 semaines');

  // Progression 65 → 80 % du Bench par pas de 5.
  await page.getByRole('button', { name: /Appliquer une progression/ }).click();
  const prog = page.getByRole('dialog');
  await expect(prog.getByRole('combobox')).toHaveValue('developpe-couche');
  await expect(prog.getByRole('button', { name: 'Bench', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await setNumber(page, 'À (%)', '80');
  await expect(prog).toContainText(/Sem\. 1 65 % · Sem\. 2 70 % · Sem\. 3 75 % · Sem\. 4 80 %/);
  await prog.getByRole('button', { name: 'Appliquer', exact: true }).click();
  await page.getByRole('tab', { name: 'Sem. 3' }).click();
  await expect(page.getByRole('textbox', { name: 'Valeur de charge série 1' })).toHaveValue('75');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toHaveText('Modèle enregistré');

  // Nouveau cycle : Mardi = Bench volume, rien d'autre.
  await page.goto('/#/cycle/nouveau');
  await page.getByLabel('Nom du cycle').fill('Bloc volume');
  await page.getByLabel('Date de début').fill(monday);
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByLabel('Mardi').selectOption({ label: 'Bench volume' });
  for (const day of ['Jeudi', 'Samedi', 'Dimanche']) await page.getByLabel(day).selectOption('');
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.getByText('7 séances seront créées.')).toBeVisible();
  await page.getByRole('button', { name: 'Créer' }).click();
  await expect(page.getByRole('status')).toHaveText('Bloc volume créé : 7 séances');

  // S3 : 75 % de 115 = 86 kg ; au-delà de S4, le cycle reprend la dernière semaine du modèle.
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  await page.getByRole('button', { name: 'Période suivante' }).click();
  await page.getByRole('button', { name: 'Période suivante' }).click();
  await page.locator('.session-card-main', { hasText: 'Bench volume' }).click();
  const set1 = page.locator('.set-pill').first();
  await expect(set1).toContainText('8 × 86 kg');
  await expect(set1).toContainText(/75\s%\sB/);
  await page.screenshot({ path: 'test-results/screens/bench-volume.png' });
});

test('progression : la semaine de deload ne fait pas avancer le pourcentage', async ({ page }) => {
  await page.goto('/#/modeles');
  await page.getByRole('link', { name: /^Bench/ }).click();
  await page.getByRole('button', { name: /Appliquer une progression/ }).click();
  const prog = page.getByRole('dialog');
  await prog.getByRole('combobox').selectOption({ label: 'Développé couché' });
  await prog.getByLabel('Toutes').check();
  await expect(prog).toContainText(/Sem\. 1 65 % · Sem\. 2 70 % · Sem\. 3 deload · Sem\. 4 75 % · Sem\. 5 80 % · Sem\. 6 85 % · Sem\. 7 85 %/);
});

test('modifier un modèle natif, mettre à jour les séances futures, puis le réinitialiser', async ({ page }) => {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Créer le Bloc 0' }).click();
  await page.goto('/#/modeles');
  await page.getByRole('link', { name: /^Deadlift/ }).click();

  // Deload du Deadlift en semaine 5 : S0, puis la vague repart.
  await expect(page.getByLabel('Semaine de deload (S0)')).toHaveValue('5');
  await expect(page.getByRole('tab')).toHaveText(['Sem. 1 S3', 'Sem. 2 S4', 'Sem. 3 S5', 'Sem. 4 S6', 'Sem. 5 S0', 'Sem. 6 S1', 'Sem. 7 S2']);

  await page.getByRole('tab', { name: /^Sem\. 7/ }).click();
  const hackReps = page.locator('section', { has: page.getByRole('combobox', { name: 'Nom de l’exercice 3' }) }).getByRole('textbox', {
    name: 'Reps série 1',
  });
  await expect(page.getByRole('combobox', { name: 'Nom de l’exercice 3' })).toHaveValue('Hack Squat');
  await hackReps.fill('12');
  await hackReps.press('Tab');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('1 séance à venir utilise ce modèle');
  await dialog.getByRole('button', { name: 'Mettre à jour ces séances' }).click();
  await expect(page.getByRole('status')).toHaveText('Modèle enregistré, 1 séance mise à jour');
  await page.screenshot({ path: 'test-results/screens/editeur-modele.png', fullPage: true });

  // Réinitialiser le natif : la S7 revient à 8 reps, et la séance future est remise d'aplomb.
  await page.getByRole('button', { name: 'Autres actions' }).click();
  await page.getByRole('button', { name: 'Réinitialiser le modèle natif' }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await page.getByRole('tab', { name: /^Sem\. 7/ }).click();
  await expect(hackReps).toHaveValue('8');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mettre à jour ces séances' }).click();
  await expect(page.getByRole('status')).toHaveText('Modèle enregistré, 1 séance mise à jour');
});
