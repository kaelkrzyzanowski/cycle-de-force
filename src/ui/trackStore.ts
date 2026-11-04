import { useEffect, useState } from 'preact/hooks';
import { todayIso } from '../domain/dates';
import { acceptPoint, elapsedMs, newClock, pauseClock, resumeClock, simplifyTrack, trackDistanceKm } from '../domain/track';
import type { TrackClock } from '../domain/track';
import type { Activity, ActivityType, TrackPoint } from '../domain/types';
import { Tracker } from '../platform/tracker';

/**
 * Activité GPS en cours, partagée par toute l'app et sauvegardée à chaque action :
 * l'enregistrement continue (service Android) quand on change d'écran ou ferme l'app.
 * Les points viennent du plugin ; on ne garde que ceux jugés fiables (précision, vitesse plausible).
 */
const STORAGE_KEY = 'cdf-recording';
const POLL_MS = 2000;

export interface Recording {
  type: ActivityType;
  startedAt: number;
  clock: TrackClock;
  finished: boolean;
}

let state: Recording | null = load();
let points: TrackPoint[] = [];
/** Dernière position connue, même imprécise (pour centrer la carte). */
let current: TrackPoint | null = null;
let cursor = 0;
let poller: number | undefined;
const listeners = new Set<() => void>();

function load(): Recording | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Recording | null;
    if (saved && typeof saved.startedAt === 'number' && saved.clock) return saved;
  } catch {
    // stockage indisponible ou illisible
  }
  return null;
}

function set(next: Recording | null): void {
  state = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // l'enregistrement continue en mémoire
  }
  schedule();
  listeners.forEach((fn) => fn());
}

async function poll(): Promise<void> {
  if (!state) return;
  const { points: raw } = await Tracker.getTrack({ from: cursor });
  for (const [lat, lon, t, seg, accuracy] of raw) {
    cursor++;
    const p: TrackPoint = { lat, lon, t, seg };
    if (accuracy <= 100) current = p;
    if (acceptPoint(points.at(-1), p, accuracy, state.type)) points.push(p);
  }
  if (raw.length > 0) listeners.forEach((fn) => fn());
}

function schedule(): void {
  window.clearInterval(poller);
  poller = undefined;
  if (state && !state.finished) poller = window.setInterval(() => void poll().catch(() => undefined), POLL_MS);
}

function reset(): void {
  points = [];
  current = null;
  cursor = 0;
}

/** Au lancement de l'app : recharge les points d'un enregistrement en cours. */
export function resumeRecording(): void {
  if (!state) return;
  reset();
  void poll().catch(() => undefined);
  schedule();
}

export const recording = {
  get: (): Recording | null => state,
  points: (): readonly TrackPoint[] => points,
  current: (): TrackPoint | null => current ?? points.at(-1) ?? null,
  distanceKm: (): number => trackDistanceKm(points),
  elapsedMs: (now = Date.now()): number => (state ? elapsedMs(state.clock, now) : 0),
  isRunning: (): boolean => state !== null && !state.finished && state.clock.runningSince !== null,

  /** Démarre l'enregistrement (demande les autorisations) ; rejette avec un code d'erreur du plugin. */
  async start(type: ActivityType, title: string): Promise<void> {
    await Tracker.startTrack({ title });
    reset();
    const now = Date.now();
    set({ type, startedAt: now, clock: newClock(now), finished: false });
  },
  async pause(): Promise<void> {
    if (!state) return;
    set({ ...state, clock: pauseClock(state.clock, Date.now()) });
    await Tracker.pauseTrack();
  },
  async resume(): Promise<void> {
    if (!state) return;
    const clock = resumeClock(state.clock, Date.now());
    set({ ...state, clock });
    await Tracker.resumeTrack({ elapsedMs: elapsedMs(clock, Date.now()) });
  },
  async finish(): Promise<void> {
    if (!state) return;
    await poll().catch(() => undefined);
    set({ ...state, clock: pauseClock(state.clock, Date.now()), finished: true });
    await Tracker.stopTrack();
  },
  /** Activité à enregistrer, d'après l'enregistrement terminé. */
  draft(id: string): Activity | null {
    if (!state) return null;
    const track = simplifyTrack(points);
    return {
      id,
      type: state.type,
      date: todayIso(new Date(state.startedAt)),
      distanceKm: Math.round(trackDistanceKm(points) * 100) / 100,
      durationSec: Math.max(1, Math.round(elapsedMs(state.clock, Date.now()) / 1000)),
      ...(track.length > 1 ? { track } : {}),
    };
  },
  /** Oublie l'enregistrement (enregistré dans les activités ou abandonné). */
  async clear(): Promise<void> {
    reset();
    set(null);
    await Tracker.clearTrack();
  },
};

/** Enregistrement courant, rafraîchi à chaque nouveau point et chaque seconde tant qu'il tourne. */
export function useRecording(): Recording | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  const running = recording.isRunning();
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return state;
}
