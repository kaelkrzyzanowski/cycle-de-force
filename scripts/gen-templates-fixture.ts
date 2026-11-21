// Génère e2e/fixtures/modeles-origine.json : le programme d'origine (5 modèles) au format « fichier de modèles »,
// importé par les tests e2e puisqu'une installation neuve démarre sans modèle.
import { writeFileSync } from 'node:fs';
import { buildTemplatesFile } from '../src/domain/templatesFile';
import { seedData } from '../src/seed';

const { templates, exercises } = seedData();
const file = buildTemplatesFile(templates, exercises, '2026-11-21T00:00:00.000Z');
writeFileSync(new URL('../e2e/fixtures/modeles-origine.json', import.meta.url), JSON.stringify(file, null, 2) + '\n');
console.log(`${file.templates.length} modèles, ${file.exercises.length} exercices`);
