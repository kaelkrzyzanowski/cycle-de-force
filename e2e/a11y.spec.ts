import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Violations WCAG 2.1 A/AA, résumées pour un message d'échec lisible. */
async function audit(page: Page, where: string): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return result.violations.map(
    (v) => `[${where}] ${v.id} (${v.impact}) : ${v.nodes.length} × ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`,
  );
}

async function seed(page: Page) {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Créer le Bloc 0' }).click();
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  await page.locator('.session-card-main', { has: page.locator('.session-name', { hasText: /^Deadlift (deload|RM|\d+%)$/ }) }).click();
  const pills = page.locator('.set-pill');
  await pills.nth(0).click();
  await pills.nth(1).click();
  await pills.nth(2).click({ delay: 700 });
  await page.getByRole('dialog').getByRole('button', { name: /Échec/ }).click();
  await pills.nth(3).click({ delay: 700 });
  await page.getByRole('dialog').getByRole('button', { name: /Cluster/ }).click();
  await pills.nth(4).click({ delay: 700 });
  await page.getByRole('dialog').getByRole('button', { name: /Non réalisé/ }).click();
}

async function auditAllScreens(page: Page, theme: string): Promise<string[]> {
  const found: string[] = [];
  const at = async (hash: string, name: string) => {
    await page.goto(hash);
    await page.locator('main').waitFor();
    await page.waitForTimeout(150);
    found.push(...(await audit(page, `${theme} ${name}`)));
  };
  await at('/#/calendrier', 'calendrier mois');
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  found.push(...(await audit(page, `${theme} calendrier semaine`)));
  await page.getByRole('button', { name: 'Actions du calendrier' }).click();
  found.push(...(await audit(page, `${theme} menu calendrier`)));
  await page.keyboard.press('Escape');

  await at('/#/aujourdhui', 'aujourd’hui');
  await page.getByRole('button', { name: 'Modifier les max' }).click();
  found.push(...(await audit(page, `${theme} feuille max`)));
  await page.keyboard.press('Escape');

  await page.goto('/#/calendrier');
  await page.locator('.session-card-main', { has: page.locator('.session-name', { hasText: /^Deadlift (deload|RM|\d+%)$/ }) }).first().click();
  await page.locator('.set-pill').first().waitFor();
  found.push(...(await audit(page, `${theme} séance`)));
  await page.locator('.set-pill').nth(6).click({ delay: 700 });
  found.push(...(await audit(page, `${theme} panneau série`)));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Modifier la séance' }).click();
  found.push(...(await audit(page, `${theme} édition séance`)));

  await at('/#/modeles', 'modèles');
  await page.getByRole('link', { name: /^Bench/ }).click();
  await page.getByRole('tab', { name: 'S1' }).waitFor();
  found.push(...(await audit(page, `${theme} éditeur modèle`)));
  await page.getByRole('button', { name: /Appliquer une progression/ }).click();
  found.push(...(await audit(page, `${theme} progression`)));
  await page.keyboard.press('Escape');

  await at('/#/cycle/nouveau', 'nouveau cycle');
  await at('/#/semaine/dupliquer', 'dupliquer semaine');
  await at('/#/stats', 'stats');
  await at('/#/reglages', 'réglages');
  return found;
}

test('accessibilité WCAG 2.1 AA : tous les écrans, thèmes sombre et clair', async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page);
  const violations = await auditAllScreens(page, 'sombre');
  await page.goto('/#/reglages');
  await page.getByRole('button', { name: 'Clair' }).click();
  violations.push(...(await auditAllScreens(page, 'clair')));
  expect(violations, violations.join('\n')).toEqual([]);
});
