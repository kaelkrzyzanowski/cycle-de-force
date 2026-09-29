import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Version bêta (app générique) : identifiant distinct de fr.cycledeforce.app pour s'installer à côté,
  // avec ses propres données. Le changer créerait encore une autre app.
  appId: 'fr.cycledeforce.beta',
  appName: 'Cycle de force β',
  webDir: 'dist',
  android: {
    backgroundColor: '#121418',
  },
};

export default config;
