import { Capacitor } from '@capacitor/core';

/**
 * Vrai dans l'application Android (Capacitor), faux dans le navigateur.
 * Le code natif (src/platform/native.ts) n'est chargé que dans l'app, par import dynamique.
 */
export const isNative: boolean = Capacitor.isNativePlatform();

export const loadNative = () => import('./native');
