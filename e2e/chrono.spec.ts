import { expect, test } from '@playwright/test';

test('minuteur : durée rapide, pause, +15 s, sonne sur un autre onglet ; chronomètre', async ({ page }) => {
  // Compte les bips émis (Web Audio) : un oscillateur par bip.
  await page.addInitScript(() => {
    const w = window as unknown as { beeps: number };
    w.beeps = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.beeps++;
      return original.call(this);
    };
  });
  await page.clock.install();
  await page.goto('/#/chrono');
  await expect(page.getByRole('heading', { name: 'Horloge' })).toBeVisible();

  const timer = page.locator('.timer-card');
  const display = timer.getByRole('timer');
  await timer.getByRole('group', { name: 'Durées rapides' }).getByRole('button', { name: '0:30' }).click();
  await page.clock.runFor(10_000);
  await expect(display).toHaveText('0:20');
  await timer.getByRole('button', { name: 'Pause' }).click();
  await page.clock.runFor(60_000);
  await expect(display).toHaveText('0:20'); // arrêté en pause
  await timer.getByRole('button', { name: 'Ajouter 15 secondes' }).click();
  await expect(display).toHaveText('0:35');
  await timer.getByRole('button', { name: 'Reprendre' }).click();

  // Sur un autre écran : la pastille suit le décompte, puis le minuteur sonne.
  await page.getByRole('link', { name: 'Calendrier', exact: true }).click();
  const pill = page.locator('.timer-pill');
  await page.clock.runFor(5_000);
  await expect(pill).toHaveText('0:30');
  await page.clock.runFor(31_000);
  await expect(pill).toHaveText('Terminé !');
  // 3 bips de décompte + 6 bips de fin.
  await expect.poll(() => page.evaluate(() => (window as unknown as { beeps: number }).beeps)).toBe(9);

  await pill.click();
  await expect(display).toHaveText('Terminé !');
  await expect(page.locator('.timer-pill')).toHaveCount(0); // pas de pastille sur l'onglet Chrono
  await timer.getByRole('button', { name: 'OK' }).click();
  await expect(display).toHaveText('0:30');

  // Chronomètre : départ, tour, pause.
  const stopwatch = page.locator('section', { has: page.getByRole('heading', { name: 'Chronomètre' }) });
  await stopwatch.getByRole('button', { name: 'Démarrer' }).click();
  await page.clock.runFor(65_000);
  await stopwatch.getByRole('button', { name: 'Tour' }).click();
  await stopwatch.getByRole('button', { name: 'Pause' }).click();
  await expect(stopwatch).toContainText('Tour 1');
  await expect(stopwatch.locator('.num').first()).toHaveText('1:05.0');
});
