import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// Chemins relatifs : la même build fonctionne à la racine d'un domaine, dans un sous-dossier
// (GitHub Pages : /cycle-de-force/) et dans la WebView de Capacitor.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Cycle de force',
        short_name: 'Cycle de force',
        description: 'Planification et suivi de cycles de force athlétique (SBD), 100 % hors ligne.',
        lang: 'fr',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e1013',
        theme_color: '#0e1013',
        categories: ['health', 'sports', 'fitness'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Aujourd’hui', short_name: 'Séance', url: './#/aujourdhui', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Calendrier', url: './#/calendrier', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
