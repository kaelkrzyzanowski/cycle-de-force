import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Identifiant définitif : le changer créerait une autre app, avec des données séparées.
  appId: 'fr.cycledeforce.app',
  appName: 'Cycle de force',
  webDir: 'dist',
  android: {
    backgroundColor: '#0e1013',
  },
};

export default config;
