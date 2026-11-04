import { WebPlugin } from '@capacitor/core';
import type { RawPoint, StepStatus, TrackerPlugin } from './tracker';

const KEY = 'cdf-track-web';

interface WebTrack {
  points: RawPoint[];
  recording: boolean;
  paused: boolean;
  seg: number;
}

/** Version navigateur : GPS par l'API de géolocalisation, page ouverte seulement ; pas de podomètre. */
export class TrackerWeb extends WebPlugin implements TrackerPlugin {
  private watch: number | null = null;
  private state: WebTrack = this.load();

  private load(): WebTrack {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as WebTrack;
    } catch {
      // stockage indisponible : on repart d'un état vide
    }
    return { points: [], recording: false, paused: false, seg: 0 };
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      // l'enregistrement continue en mémoire
    }
  }

  private listen(): void {
    if (this.watch !== null || !this.state.recording || !('geolocation' in navigator)) return;
    this.watch = navigator.geolocation.watchPosition(
      (pos) => {
        if (!this.state.recording || this.state.paused) return;
        this.state.points.push([pos.coords.latitude, pos.coords.longitude, pos.timestamp, this.state.seg, pos.coords.accuracy]);
        this.save();
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 0 },
    );
  }

  private unlisten(): void {
    if (this.watch !== null) navigator.geolocation.clearWatch(this.watch);
    this.watch = null;
  }

  stepStatus(): Promise<StepStatus> {
    return Promise.resolve({ available: false, granted: false, enabled: false });
  }
  startSteps(): Promise<{ enabled: boolean }> {
    return Promise.reject(Object.assign(new Error('Podomètre disponible dans l’app Android'), { code: 'NO_SENSOR' }));
  }
  stopSteps(): Promise<void> {
    return Promise.resolve();
  }
  ensureSteps(): Promise<void> {
    return Promise.resolve();
  }
  getSteps(): Promise<{ days: Record<string, number> }> {
    return Promise.resolve({ days: {} });
  }

  async startTrack(): Promise<void> {
    if (!('geolocation' in navigator)) throw Object.assign(new Error('Géolocalisation indisponible'), { code: 'UNAVAILABLE' });
    // Demande l'autorisation tout de suite, pour signaler un refus à l'écran.
    await new Promise<void>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        () => resolve(),
        (err) => reject(Object.assign(new Error(err.message), { code: err.code === err.PERMISSION_DENIED ? 'DENIED' : 'GPS_OFF' })),
        { enableHighAccuracy: true, timeout: 15_000 },
      ),
    );
    this.unlisten();
    this.state = { points: [], recording: true, paused: false, seg: 0 };
    this.save();
    this.listen();
  }
  pauseTrack(): Promise<void> {
    this.state.paused = true;
    this.save();
    return Promise.resolve();
  }
  resumeTrack(): Promise<void> {
    if (this.state.paused) {
      this.state.paused = false;
      this.state.seg++;
      this.save();
    }
    return Promise.resolve();
  }
  stopTrack(): Promise<void> {
    this.state.recording = false;
    this.unlisten();
    this.save();
    return Promise.resolve();
  }
  clearTrack(): Promise<void> {
    this.unlisten();
    this.state = { points: [], recording: false, paused: false, seg: 0 };
    try {
      localStorage.removeItem(KEY);
    } catch {
      // rien à effacer
    }
    return Promise.resolve();
  }
  getTrack({ from }: { from: number }): Promise<{ points: RawPoint[]; recording: boolean; paused: boolean }> {
    this.listen(); // page rechargée pendant un enregistrement
    return Promise.resolve({ points: this.state.points.slice(from), recording: this.state.recording, paused: this.state.paused });
  }
}
