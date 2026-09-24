// Vérifie le site publié : installabilité Chrome et ouverture hors ligne.
// Usage : node scripts/check-live.mjs [url]
import { chromium, devices } from '@playwright/test';

const URL = process.argv[2] ?? 'https://kaelkrzyzanowski.github.io/cycle-de-force/';
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 7'] });
const page = await context.newPage();
await page.goto(URL);
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
const cdp = await context.newCDPSession(page);
const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
await context.setOffline(true);
await page.goto(`${URL}#/modeles`);
await page.reload();
const models = await page.locator('.template-row .name').allInnerTexts();
console.log(JSON.stringify({ installabilityErrors, offlineModels: models.length }));
await browser.close();
