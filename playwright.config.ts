import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;

/** Les tests E2E tournent sur le build de production (service worker actif). */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
  },
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
  },
});
