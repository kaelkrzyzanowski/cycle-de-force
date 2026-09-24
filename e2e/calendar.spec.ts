import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addDays, mondayOf, todayIso } from '../src/domain/dates';

const monday = mondayOf(todayIso());

async function showWeekView(page: Page) {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  // Le calendrier garde sa position en mémoire : revenir à aujourd'hui.
  const today = page.getByRole('button', { name: 'Aujourd’hui', exact: true });
  if (await today.isEnabled()) await today.click();
}

async function nextWeeks(page: Page, n: number) {
  for (let i = 0; i < n; i++) await page.getByRole('button', { name: 'Période suivante' }).click();
}

const cards = (page: Page) => page.locator('.session-card .session-name');

test('créer un cycle de 7 semaines avec l’assistant et le voir dans le calendrier', async ({ page }) => {
  await page.goto('/#/cycle/nouveau');
  await page.getByLabel('Nom du cycle').fill('Bloc test');
  await page.getByLabel('Date de début').fill(addDays(monday, 2)); // un mercredi : ramené au lundi
  await expect(page.getByText(/Le cycle commence le lundi/)).toBeVisible();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.getByRole('heading', { name: 'Max théoriques' })).toBeVisible();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.getByLabel('Mardi')).toHaveValue('tpl-deadlift');
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.getByText('28 séances seront créées.')).toBeVisible();
  await page.getByRole('button', { name: 'Créer' }).click();
  await expect(page.getByRole('status')).toHaveText('Bloc test créé : 28 séances');

  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  await expect(page.getByText('Bloc test · semaine 1/7')).toBeVisible();
  // Nom calculé depuis le % du mouvement principal (deload / RM / % du max), jamais un numéro de semaine.
  await expect(cards(page)).toHaveText(['Deadlift 80%', 'SBD', 'Bench 90%', 'Squat deload']);
  await nextWeeks(page, 6);
  await expect(page.getByText('Bloc test · semaine 7/7')).toBeVisible();
  await expect(cards(page)).toHaveText(['Deadlift 75%', 'SBD', 'Bench 85%', 'Squat RM']);
  await nextWeeks(page, 1);
  await expect(cards(page)).toHaveCount(0);
});

test('dupliquer une semaine vers une date libre, puis sur une semaine occupée', async ({ page }) => {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Créer le Bloc 0' }).click();
  await expect(page.getByRole('status')).toHaveText('Bloc 0 créé : 28 séances');

  // Semaine 2 → semaine libre après le cycle.
  const week2 = addDays(monday, 7);
  const free = addDays(monday, 70);
  await page.goto(`/#/semaine/dupliquer/${week2}`);
  await expect(page.getByText('4 séances', { exact: true })).toBeVisible();
  await page.getByLabel('Semaine cible').fill(free);
  await expect(page.getByText('Jours déjà occupés')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dupliquer la semaine' }).click();
  await expect(page.getByRole('status')).toHaveText('4 séances créées');

  await showWeekView(page);
  await nextWeeks(page, 10);
  await expect(cards(page)).toHaveText(['Deadlift', 'SBD', 'Bench', 'Squat']);
  await expect(page.getByText('Aucun cycle en cours')).toBeVisible();

  // Semaine 2 → semaine 3 (occupée) : il faut choisir, puis remplacer.
  await page.goto(`/#/semaine/dupliquer/${week2}`);
  await expect(page.getByText('Jours déjà occupés')).toBeVisible();
  const submit = page.getByRole('button', { name: 'Dupliquer la semaine' });
  await expect(submit).toBeDisabled();
  await page.getByRole('group', { name: 'Pour tous les jours' }).getByRole('button', { name: 'Remplacer' }).click();
  await submit.click();
  await expect(page.getByRole('status')).toHaveText('4 séances créées');

  await showWeekView(page);
  await nextWeeks(page, 2);
  await expect(cards(page)).toHaveText(['Deadlift 85%', 'SBD', 'Bench deload', 'Squat deload']);
});

test('dupliquer le cycle avec Deadlift +5 kg', async ({ page }) => {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Créer le Bloc 0' }).click();
  await page.getByRole('link', { name: /Bloc 0 · semaine 1\/7/ }).click();
  await page.getByRole('link', { name: 'Dupliquer le cycle' }).click();

  await expect(page.getByLabel('Nom du nouveau cycle')).toHaveValue('Bloc 0 (suite)');
  await expect(page.getByLabel('Date de début')).toHaveValue(addDays(monday, 49));
  await expect(page.getByRole('radio', { name: 'Régénérer depuis les modèles' })).toBeChecked();
  await page.getByRole('button', { name: 'Deadlift +5 kg' }).click();
  await expect(page.getByRole('textbox', { name: 'Deadlift', exact: true })).toHaveValue('215');
  await expect(page.getByText('28 séances seront créées.')).toBeVisible();
  await page.getByRole('button', { name: 'Créer le cycle' }).click();

  await expect(page.getByRole('status')).toHaveText('Bloc 0 (suite) créé : 28 séances');
  await expect(page.getByRole('heading', { name: 'Bloc 0 (suite)', level: 2 })).toBeVisible();
  await expect(page.locator('.max-grid')).toHaveText(/Squat\s*170\s*Bench\s*115\s*Deadlift\s*215/);
});

test('menu d’une séance : déplacer puis supprimer', async ({ page }) => {
  await page.goto('/#/calendrier');
  await page.getByRole('button', { name: 'Créer le Bloc 0' }).click();
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  await nextWeeks(page, 1);

  await page.getByRole('button', { name: 'Actions sur la séance SBD' }).click();
  await page.getByRole('button', { name: 'Déplacer à une autre date' }).click();
  await page.getByLabel('Nouvelle date').fill(addDays(monday, 7 + 4)); // vendredi
  await page.getByRole('button', { name: 'Déplacer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Séance déplacée');
  const friday = page.locator('.week-day').nth(4);
  await expect(friday.locator('.session-name')).toHaveText(['SBD']);

  await page.getByRole('button', { name: 'Actions sur la séance SBD' }).click();
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('status')).toHaveText('Séance supprimée');
  await expect(cards(page)).toHaveText(['Deadlift 85%', 'Bench RM', 'Squat deload']);
});
