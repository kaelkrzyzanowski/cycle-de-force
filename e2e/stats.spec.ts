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

test('stats : période, tuiles, tonnage par semaine, charge max et e1RM', async ({ page }) => {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Créer le Bloc 0' }).click();
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();

  // Semaine 1 : Deadlift entièrement validé.
  await page.locator('.session-card-main', { has: page.locator('.session-name', { hasText: /^Deadlift (deload|RM|\d+%)$/ }) }).click();
  await validateAll(page);
  await expect(page.locator('.totals-bar')).toContainText(/11\s?592\skg/);

  // Semaine 2 : Deadlift validé, dernière série lourde en échec (2 × 179).
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Période suivante' }).click();
  await page.locator('.session-card-main', { has: page.locator('.session-name', { hasText: /^Deadlift (deload|RM|\d+%)$/ }) }).click();
  await validateAll(page);
  const last = page.locator('.exercise-card', { has: page.getByRole('heading', { name: 'Deadlift Sumo + Inche mur' }) }).locator('.set-pill').nth(3);
  await last.click({ delay: 700 });
  await page.getByRole('textbox', { name: 'Reps réalisées' }).fill('2');
  await page.getByRole('textbox', { name: 'Reps réalisées' }).press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: /Échec/ }).click();

  await page.goto('/#/stats');
  await expect(page.getByRole('button', { name: '3 mois' })).toHaveAttribute('aria-pressed', 'true');
  const tiles = page.locator('.stat-tile');
  await expect(tiles.nth(0)).toContainText('2');
  await expect(tiles.nth(1)).toContainText(/22\s?330\skg/); // S1 11 592 + S2 10 738
  await expect(tiles.nth(2)).toContainText(/0\skm/);

  // Tonnage par semaine : deux semaines travaillées dans le tableau.
  const tonnageCard = page.locator('.chart-card', { has: page.getByRole('heading', { name: 'Tonnage' }) });
  await expect(tonnageCard.locator('.chart-subtitle')).toHaveText('Par semaine');
  await tonnageCard.getByText('Voir les données').click();
  await expect(tonnageCard.locator('tbody tr')).toHaveCount(2);
  await expect(tonnageCard.locator('tbody tr td')).toHaveText([/11\s?592/, /10\s?738/]);
  await expect(page.locator('.chart-card', { has: page.getByRole('heading', { name: 'Cardio' }) })).toHaveCount(0);

  // Charge max et e1RM : « Deadlift Sumo + Inche mur » choisi par défaut.
  const exCard = page.locator('.chart-card', { has: page.getByRole('heading', { name: 'Charge max et e1RM' }) });
  await expect(exCard.getByRole('combobox', { name: 'Exercice' })).toHaveValue('deadlift-sumo-inche-mur');
  await exCard.getByText('Voir les données').click();
  await expect(exCard.locator('tbody tr')).toHaveCount(2);
  await expect(exCard.locator('tbody tr').nth(0).locator('td')).toHaveText(['168', '196']); // 5 × 168
  await expect(exCard.locator('tbody tr').nth(1).locator('td')).toHaveText(['179', '202,9']); // 4 × 179
  await expect(exCard.locator('.line')).toHaveCount(2);

  // « Tout » : regroupement par mois, même total.
  await page.getByRole('button', { name: 'Tout' }).click();
  await expect(tonnageCard.locator('.chart-subtitle')).toHaveText('Par mois');
  await expect(tiles.nth(1)).toContainText(/22\s?330\skg/);
  await expect(page.locator('.chart-card')).toHaveCount(2);

  await page.screenshot({ path: 'test-results/screens/stats.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#/reglages');
  await page.getByRole('button', { name: 'Clair' }).click();
  await page.goto('/#/stats');
  await expect(page.locator('.chart-card').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/stats-clair.png', fullPage: true });
});
