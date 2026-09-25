// Génère les icônes de l'application depuis la photo source (assets/icon-source.webp).
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SOURCE = fileURLToPath(new URL('../assets/icon-source.webp', import.meta.url));
const BG = '#0e1013';
const PNG = { compressionLevel: 9 };

const square = (size) => sharp(SOURCE).resize(size, size, { fit: 'cover' }).png(PNG);

/** Photo réduite à `inset` (0..1) et centrée sur un fond uni carré : zone sûre des icônes adaptatives/maskable. */
async function onBackground(size, inset) {
  const photo = await square(Math.round(size * inset)).toBuffer();
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
  await (await onBackground(512, 0.8)).toFile(at('icon-maskable-512.png', iconsDir)); // zone sûre de 80 %
  await square(180).toFile(at('apple-touch-icon.png', iconsDir));
  await square(192).toFile(at('favicon.png', iconsDir)); // onglet du navigateur + écran de démarrage
  console.log('Icônes générées dans public/icons/');

  // Sources pour l'application Android (`npx capacitor-assets generate --android`).
  await square(1024).toFile(at('icon-only.png', assetsDir));
  await (await onBackground(1024, 0.66)).toFile(at('icon-foreground.png', assetsDir)); // zone sûre adaptative (~66 %)
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).png(PNG).toFile(at('icon-background.png', assetsDir));
  await (await onBackground(2732, 0.3)).toFile(at('splash.png', assetsDir));
  await (await onBackground(2732, 0.3)).toFile(at('splash-dark.png', assetsDir));
  console.log('Sources Android générées dans assets/');
}

main();
