import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Clique « Tout valider » tant qu'il en reste (chaque bouton disparaît une fois l'exercice validé). */
async function validateAll(page: Page) {
  const buttons = page.getByRole('button', { name: /Tout valider/ });
  await expect(buttons.first()).toBeVisible();
  for (let n = await buttons.count(); n > 0; n--) {
    await buttons.first().click();
    await expect(buttons).toHaveCount(n - 1);
  }
}

test('stats : tonnage par semaine, charge max et e1RM, max S/B/D', async ({ page }) => {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Créer le Bloc 0' }).click();
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();

  // S1 : Deadlift entièrement validé.
  await page.locator('.session-card-main', { has: page.locator('.session-name', { hasText: /^Deadlift S\d$/ }) }).click();
  await validateAll(page);
  await expect(page.locator('.totals-bar')).toContainText(/11\s?592\skg/);

  // S2 : Deadlift validé, dernière série lourde en échec (2 × 179).
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Période suivante' }).click();
  await page.locator('.session-card-main', { has: page.locator('.session-name', { hasText: /^Deadlift S\d$/ }) }).click();
  await validateAll(page);
  const last = page.locator('.exercise-card', { has: page.getByRole('heading', { name: 'Deadlift Sumo + Inche mur' }) }).locator('.set-pill').nth(3);
  await last.click({ delay: 700 });
  await page.getByRole('textbox', { name: 'Reps réalisées' }).fill('2');
  await page.getByRole('textbox', { name: 'Reps réalisées' }).press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: /Échec/ }).click();

  // Max D 210 → 215.
  await page.goto('/#/aujourdhui');
  await page.getByRole('button', { name: 'Modifier les max' }).click();
  await page.getByRole('textbox', { name: 'Deadlift', exact: true }).fill('215');
  await page.getByRole('textbox', { name: 'Deadlift', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Enregistrer les max' }).click();

  await page.goto('/#/stats');
  await expect(page.locator('.stat-tile').first()).toContainText(/22\s?330\skg/); // S1 11 592 + S2 10 738

  // Tonnage par semaine du cycle en cours : infobulle au tap sur S2.
  const weekCard = page.locator('.chart-card', { has: page.getByRole('heading', { name: 'Tonnage par semaine' }) });
  const weekChart = weekCard.getByRole('img', { name: /Tonnage par semaine/ });
  const box = (await weekChart.boundingBox())!;
  await weekChart.click({ position: { x: 40 + ((box.width - 48) / 7) * 1.5, y: box.height / 2 } });
  await expect(weekCard.locator('.chart-tip')).toContainText(/10\s?738\skg/);
  await expect(weekCard.locator('.chart-tip')).toContainText('Bloc 0 · Sem. 2');
  await weekCard.getByText('Voir les données').click();
  await expect(weekCard.locator('tbody tr')).toHaveCount(7);

  // Charge max et e1RM : « Deadlift Sumo + Inche mur » choisi par défaut.
  const exCard = page.locator('.chart-card', { has: page.getByRole('heading', { name: 'Charge max et e1RM' }) });
  await expect(exCard.getByRole('combobox', { name: 'Exercice' })).toHaveValue('deadlift-sumo-inche-mur');
  await exCard.getByText('Voir les données').click();
  await expect(exCard.locator('tbody tr')).toHaveCount(2);
  await expect(exCard.locator('tbody tr').nth(0).locator('td')).toHaveText(['168', '196']); // 5 × 168
  await expect(exCard.locator('tbody tr').nth(1).locator('td')).toHaveText(['179', '202,9']); // 4 × 179
  await expect(exCard.locator('.line')).toHaveCount(2);

  // Max théoriques : D passe de 210 à 215.
  const maxCard = page.locator('.chart-card', { has: page.getByRole('heading', { name: 'Max théoriques' }) });
  await expect(maxCard.locator('.legend')).toContainText(/Squat.*Bench.*Deadlift/);
  await maxCard.getByText('Voir les données').click();
  await expect(maxCard.locator('tbody tr').first().locator('td')).toHaveText(['Bloc 0', '170', '115', '210']);
  await expect(maxCard.locator('tbody tr').last().locator('td')).toHaveText(['Bloc 0', '170', '115', '215']);

  // Statuts : 35 validées, 1 échec.
  const statusCard = page.locator('.chart-card', { has: page.getByRole('heading', { name: 'Statuts des séries' }) });
  await expect(statusCard.getByRole('button', { name: /Bloc 0 · Échec : 1/ })).toBeVisible();
  await expect(statusCard.getByRole('button', { name: /Bloc 0 · Validé : 35/ })).toBeVisible();

  await page.screenshot({ path: 'test-results/screens/stats.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#/reglages');
  await page.getByRole('button', { name: 'Clair' }).click();
  await page.goto('/#/stats');
  await expect(page.locator('.chart-card').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/stats-clair.png', fullPage: true });
});
