// Génère les icônes PNG de l'application (barre olympique stylisée), sans dépendance.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x0e, 0x10, 0x13];
const ACCENT = [0x4c, 0xc2, 0xff];
const PLATE = [0xee, 0xf0, 0xf3];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    pixels.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Rectangles en coordonnées relatives (0..1) centrés verticalement : [x0, x1, hauteur, couleur]. */
function shapes(scale) {
  const c = (v) => 0.5 + (v - 0.5) * scale;
  const h = (v) => v * scale;
  return [
    [c(0.14), c(0.86), h(0.05), ACCENT], // barre
    [c(0.2), c(0.26), h(0.3), PLATE], // disques extérieurs
    [c(0.74), c(0.8), h(0.3), PLATE],
    [c(0.27), c(0.34), h(0.44), PLATE], // disques intérieurs
    [c(0.66), c(0.73), h(0.44), PLATE],
    [c(0.35), c(0.37), h(0.12), ACCENT], // colliers
    [c(0.63), c(0.65), h(0.12), ACCENT],
  ];
}

function draw(size, scale) {
  const px = Buffer.alloc(size * size * 3);
  const rects = shapes(scale);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      let color = BG;
      for (const [x0, x1, hh, col] of rects) {
        if (u >= x0 && u <= x1 && Math.abs(v - 0.5) <= hh / 2) color = col;
      }
      px.set(color, (y * size + x) * 3);
    }
  }
  return png(size, px);
}

function svg() {
  const rects = shapes(1)
    .map(([x0, x1, hh, col]) => {
      const f = (n) => Math.round(n * 1000) / 10;
      const hex = '#' + col.map((c) => c.toString(16).padStart(2, '0')).join('');
      return `<rect x="${f(x0)}" y="${f(0.5 - hh / 2)}" width="${f(x1 - x0)}" height="${f(hh)}" rx="1.5" fill="${hex}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#0e1013"/>${rects}</svg>\n`;
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon-192.png', out), draw(192, 1));
writeFileSync(new URL('icon-512.png', out), draw(512, 1));
writeFileSync(new URL('icon-maskable-512.png', out), draw(512, 0.72)); // zone sûre de 80 %
writeFileSync(new URL('apple-touch-icon.png', out), draw(180, 0.85));
writeFileSync(new URL('favicon.svg', out), svg());
console.log('Icônes générées dans public/icons/');
