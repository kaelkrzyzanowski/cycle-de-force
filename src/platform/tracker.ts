import { registerPlugin } from '@capacitor/core';
import type { IsoDate } from '../domain/types';

/** Point brut : latitude, longitude, instant (ms), segment, précision (m). */
export type RawPoint = [number, number, number, number, number];

export interface StepStatus {
  /** Le téléphone a un compteur de pas matériel. */
  available: boolean;
  granted: boolean;
  enabled: boolean;
}

/**
 * Podomètre et enregistrement GPS. Android : plugin natif (TrackerPlugin.java, services au premier plan).
 * Navigateur : pas de podomètre ; GPS seulement page ouverte (trackerWeb.ts).
 * Erreurs possibles (`code`) : NO_SENSOR, DENIED, GPS_OFF, UNAVAILABLE.
 */
export interface TrackerPlugin {
  stepStatus(): Promise<StepStatus>;
  startSteps(): Promise<{ enabled: boolean }>;
  stopSteps(): Promise<void>;
  ensureSteps(): Promise<void>;
  getSteps(): Promise<{ days: Record<IsoDate, number> }>;

  startTrack(options: { title: string }): Promise<void>;
  pauseTrack(): Promise<void>;
  resumeTrack(options: { elapsedMs: number }): Promise<void>;
  stopTrack(): Promise<void>;
  clearTrack(): Promise<void>;
  getTrack(options: { from: number }): Promise<{ points: RawPoint[]; recording: boolean; paused: boolean }>;
}

export const Tracker = registerPlugin<TrackerPlugin>('Tracker', {
  web: () => import('./trackerWeb').then((m) => new m.TrackerWeb()),
});

export const errorCode = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : undefined;
