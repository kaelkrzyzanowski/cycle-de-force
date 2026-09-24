import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function createBloc0(page: Page) {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Créer le Bloc 0' }).click();
  await expect(page.getByRole('status')).toHaveText('Bloc 0 créé : 28 séances');
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
}

async function openDeadliftS1(page: Page) {
  await page.goto('/#/calendrier');
  await page.locator('.session-card-main', { hasText: 'Deadlift' }).first().click();
  await expect(page.getByRole('heading', { name: 'Deadlift', level: 2 })).toBeVisible();
}

const pill = (page: Page, exercise: string, n: number) =>
  page.locator('.exercise-card', { has: page.getByRole('heading', { name: exercise, exact: true }) }).locator('.set-pill').nth(n);

test('valider en un tap, saisir un échec, annuler, changer le max D', async ({ page }) => {
  await createBloc0(page);
  await openDeadliftS1(page);

  const first = pill(page, "Deadlift Sumo 2''+ iso", 0);
  await expect(first).toContainText('4 × 147 kg');
  await expect(first).toContainText(/70\s%\sD/);

  // Un tap = validé.
  await first.click();
  await expect(first).toHaveClass(/st-VALIDATED/);
  await expect(page.locator('.totals-bar')).toContainText(/588\skg/);

  // Appui long = panneau ; échec à 3 reps × 168 kg.
  const heavy = pill(page, 'Deadlift Sumo + Inche mur', 0);
  await expect(heavy).toContainText('5 × 168 kg');
  await heavy.click({ delay: 700 });
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('Prévu : 5 × 168 kg');
  await sheet.getByRole('textbox', { name: 'Reps réalisées' }).fill('3');
  await sheet.getByRole('textbox', { name: 'Reps réalisées' }).press('Enter');
  await sheet.getByRole('button', { name: /Échec/ }).click();
  await expect(heavy).toHaveClass(/st-FAILED/);
  await expect(heavy.locator('.set-main')).toHaveText('3 × 168 kg');
  await expect(heavy.locator('.set-planned')).toHaveText('5 × 168 kg');
  await expect(page.locator('.totals-bar')).toContainText(/1\s?092\skg/); // 588 + 3 × 168

  // Re-tap sur validé = retour à prévu, puis « Annuler ».
  await first.click();
  await expect(first).toHaveClass(/st-PLANNED/);
  await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click();
  await expect(first).toHaveClass(/st-VALIDATED/);
  await page.screenshot({ path: 'test-results/screens/seance.png', fullPage: true });

  // La pastille du calendrier suit : séance entamée.
  await page.goto('/#/calendrier');
  await expect(page.locator('.session-card', { hasText: 'Deadlift' }).first()).toHaveClass(/st-IN_PROGRESS/);

  // Max D 210 → 215 : aperçu, puis seules les séries non faites changent.
  await page.goto('/#/aujourdhui');
  await page.getByRole('button', { name: 'Modifier les max' }).click();
  const maxSheet = page.getByRole('dialog');
  await maxSheet.getByRole('textbox', { name: 'Deadlift', exact: true }).fill('215');
  await maxSheet.getByRole('textbox', { name: 'Deadlift', exact: true }).press('Enter');
  await expect(maxSheet).toContainText(/séries planifiées vont changer/);
  await expect(maxSheet).toContainText(/147 → 151 kg/);
  await page.screenshot({ path: 'test-results/screens/max.png' });
  await maxSheet.getByRole('button', { name: 'Enregistrer les max' }).click();
  await expect(page.getByRole('status')).toHaveText('Max enregistrés');

  await openDeadliftS1(page);
  await expect(first.locator('.set-main')).toHaveText('4 × 147 kg'); // validée : figée
  await expect(pill(page, "Deadlift Sumo 2''+ iso", 1).locator('.set-main')).toHaveText('4 × 151 kg');
  await expect(heavy.locator('.set-main')).toHaveText('3 × 168 kg'); // échec : figé
  await expect(pill(page, 'Deadlift Sumo + Inche mur', 1).locator('.set-main')).toHaveText('5 × 172 kg');
});

test('modifier une séance et propager aux semaines suivantes', async ({ page }) => {
  await createBloc0(page);
  await openDeadliftS1(page);
  await page.getByRole('button', { name: 'Modifier la séance' }).click();
  const name3 = page.getByRole('combobox', { name: 'Nom de l’exercice 3' });
  const hack = page.locator('section', { has: name3 });
  await expect(name3).toHaveValue('Hack Squat');
  await hack.getByRole('textbox', { name: 'Reps série 1' }).fill('10');
  await hack.getByRole('textbox', { name: 'Reps série 1' }).press('Tab');
  await page.getByRole('button', { name: 'Terminer' }).click();
  await page.getByRole('button', { name: /Aussi les semaines suivantes de ce cycle \(6 séances\)/ }).click();
  await expect(page.getByRole('status')).toHaveText('Modifié dans 7 séances');
  await expect(pill(page, 'Hack Squat', 0).locator('.set-main')).toHaveText('10 × 80 kg');
});

test('exporter puis restaurer une sauvegarde sur un appareil vierge', async ({ page, browser }) => {
  await createBloc0(page);
  await openDeadliftS1(page);
  await pill(page, "Deadlift Sumo 2''+ iso", 0).click();
  await pill(page, "Deadlift Sumo 2''+ iso", 1).click();

  await page.goto('/#/reglages');
  await expect(page.getByText('Aucune sauvegarde pour l’instant.')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter une sauvegarde' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^cycle-de-force-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const exported = JSON.parse(await readFile(path, 'utf8')) as { app: string; counts: Record<string, number>; data: unknown };
  expect(exported.app).toBe('cycle-de-force');
  expect(exported.counts).toMatchObject({ cycles: 1, sessions: 28, realizedSets: 2 });
  await expect(page.getByText(/Dernière sauvegarde/)).toBeVisible();

  // Appareil vierge : nouveau contexte, stockage vide.
  const fresh = await browser.newContext({ ...test.info().project.use });
  const other = await fresh.newPage();
  await other.goto('/#/reglages');
  const input = other.locator('input[type="file"]');

  await input.setInputFiles({ name: 'autre.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"autre"}') });
  await expect(other.getByRole('alert')).toHaveText('Ce fichier ne vient pas de Cycle de force.');
  await other.getByRole('button', { name: 'Fermer' }).click();

  await input.setInputFiles(path);
  const dialog = other.getByRole('dialog');
  await expect(dialog).toContainText('1 cycle · 28 séances · 2 séries réalisées');
  await dialog.getByRole('button', { name: 'Remplacer toutes mes données' }).click();
  await expect(other.getByRole('status')).toHaveText('Données restaurées');
  await expect(other.getByRole('button', { name: 'Télécharger la copie d’avant restauration' })).toBeVisible();

  // Base identique : on réexporte et on compare.
  const [again] = await Promise.all([
    other.waitForEvent('download'),
    other.getByRole('button', { name: 'Exporter une sauvegarde' }).click(),
  ]);
  const reexported = JSON.parse(await readFile(await again.path(), 'utf8')) as { data: unknown };
  expect(reexported.data).toEqual(exported.data);

  await other.goto('/#/calendrier');
  await other.getByRole('button', { name: 'Semaine', exact: true }).click();
  await expect(other.locator('.session-card', { hasText: 'Deadlift' }).first()).toHaveClass(/st-IN_PROGRESS/);
  await fresh.close();
});
