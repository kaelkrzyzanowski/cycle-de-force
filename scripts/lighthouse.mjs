// Audit Lighthouse des écrans principaux sur la build de production.
// Prérequis : `npm run build` puis `npm run preview -- --port 4174` dans un autre terminal.
// Lance le Chromium de Playwright sur un port de débogage dédié et y connecte Lighthouse (API Node).
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = 9333;
const BASE = process.env.BASE_URL ?? 'http://localhost:4174/';
const ROUTES = ['calendrier', 'aujourdhui', 'modeles', 'stats', 'reglages'];
const OUT = 'test-results/lighthouse';
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`] });
const rows = [];
try {
  for (const route of ROUTES) {
    const result = await lighthouse(`${BASE}#/${route}`, {
      port: PORT,
      output: 'json',
      logLevel: 'error',
      onlyCategories: CATEGORIES,
    });
    if (!result) throw new Error(`Pas de rapport pour ${route}`);
    writeFileSync(`${OUT}/lh-${route}.json`, String(result.report));
    const { categories } = result.lhr;
    rows.push({ écran: route, ...Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((categories[c]?.score ?? 0) * 100)])) });
    const failing = Object.values(result.lhr.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode === 'binary');
    for (const a of failing) console.log(`  [${route}] ${a.id} : ${a.title}`);
  }
} finally {
  await browser.close();
}
console.table(rows);
