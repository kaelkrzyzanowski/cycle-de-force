// Génère les icônes de l'application depuis la photo source (assets/icon-source.webp).
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SOURCE = fileURLToPath(new URL('../assets/icon-source.webp', import.meta.url));
/** Cadrage serré sur l'athlète (photo source 1254 × 1254) : de la tête à la barre. */
const CROP = { left: 315, top: 30, width: 700, height: 700 };
const BG = '#0e1013';
const PNG = { compressionLevel: 9 };

const square = (size) => sharp(SOURCE).extract(CROP).resize(size, size, { fit: 'cover' }).png(PNG);

/**
 * Photo réduite à `inset` (0..1) et centrée sur un fond uni carré : zone sûre des icônes adaptatives/maskable.
 * `round` découpe la photo en disque (écran de démarrage).
 */
async function onBackground(size, inset, round = false) {
  const side = Math.round(size * inset);
  let photo = await square(side).toBuffer();
  if (round) {
    const disc = Buffer.from(`<svg width="${side}" height="${side}"><circle cx="${side / 2}" cy="${side / 2}" r="${side / 2}" fill="#fff"/></svg>`);
    photo = await sharp(photo).composite([{ input: disc, blend: 'dest-in' }]).png(PNG).toBuffer();
  }
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } }).composite([{ input: photo, gravity: 'center' }]).png(PNG);
}

async function main() {
  const iconsDir = new URL('../public/icons/', import.meta.url);
  const assetsDir = new URL('../assets/', import.meta.url);
  mkdirSync(iconsDir, { recursive: true });
  const at = (rel, base) => fileURLToPath(new URL(rel, base));

  // PWA
  await square(192).toFile(at('icon-192.png', iconsDir));
  await square(512).toFile(at('icon-512.png', iconsDir));
  // Maskable : le masque ne garde que le disque central de 80 % ; la photo le couvre entièrement.
  await (await onBackground(512, 0.9)).toFile(at('icon-maskable-512.png', iconsDir));
  await square(180).toFile(at('apple-touch-icon.png', iconsDir));
  await square(192).toFile(at('favicon.png', iconsDir)); // onglet du navigateur + écran de démarrage
  console.log('Icônes générées dans public/icons/');

  // Sources pour l'application Android (`npx capacitor-assets generate --android`).
  await square(1024).toFile(at('icon-only.png', assetsDir));
  // Icône adaptative : le lanceur n'affiche que les ~66 % centraux ; 75 % couvre aussi les masques carrés arrondis.
  await (await onBackground(1024, 0.75)).toFile(at('icon-foreground.png', assetsDir));
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).png(PNG).toFile(at('icon-background.png', assetsDir));
  await (await onBackground(2732, 0.3, true)).toFile(at('splash.png', assetsDir));
  await (await onBackground(2732, 0.3, true)).toFile(at('splash-dark.png', assetsDir));
  console.log('Sources Android générées dans assets/');
}

main();
