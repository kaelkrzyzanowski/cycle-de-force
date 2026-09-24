import { DEFAULT_SETTINGS } from '../domain/types';
import type { Cycle, Exercise, IsoDate, MaxChange, Session, SessionTemplate, Settings } from '../domain/types';
import { seedData, SEED_VERSION } from '../seed';
import { openCdfDb, DB_NAME } from './db';
import type { CdfDb } from './db';

/**
 * Unique point d'accès aux données. L'UI ne connaît que cette interface,
 * pour pouvoir brancher plus tard un autre stockage (Capacitor) sans la toucher.
 */
export interface Repository {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  listTemplates(): Promise<SessionTemplate[]>;
  getTemplate(id: string): Promise<SessionTemplate | undefined>;
  saveTemplate(template: SessionTemplate): Promise<void>;
  deleteTemplate(id: string): Promise<void>;

  listExercises(): Promise<Exercise[]>;
  saveExercise(exercise: Exercise): Promise<void>;

  listCycles(): Promise<Cycle[]>;
  getCycle(id: string): Promise<Cycle | undefined>;
  saveCycle(cycle: Cycle): Promise<void>;
  deleteCycle(id: string): Promise<void>;

  /** Séances entre deux dates incluses, triées par date. */
  listSessionsBetween(from: IsoDate, to: IsoDate): Promise<Session[]>;
  listSessionsByCycle(cycleId: string): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  saveSessions(sessions: readonly Session[]): Promise<void>;
  deleteSession(id: string): Promise<void>;

  listMaxChanges(cycleId?: string): Promise<MaxChange[]>;
  addMaxChanges(changes: readonly MaxChange[]): Promise<void>;

  /** Applique plusieurs écritures en une seule transaction : tout ou rien. */
  applyChanges(changes: Changes): Promise<void>;

  getFlag(key: string): Promise<string | undefined>;
  setFlag(key: string, value: string): Promise<void>;

  /** Charge les modèles natifs et le catalogue au premier lancement. */
  ensureSeeded(): Promise<{ seeded: boolean }>;
  close(): void;
}

export interface Changes {
  saveCycles?: readonly Cycle[];
  saveSessions?: readonly Session[];
  deleteSessionIds?: readonly string[];
  addMaxChanges?: readonly MaxChange[];
}

const SETTINGS_KEY = 'current';
const byDate = (a: Session, b: Session): number => a.date.localeCompare(b.date);

class IdbRepository implements Repository {
  constructor(private readonly db: CdfDb) {}

  async getSettings(): Promise<Settings> {
    const stored = await this.db.get('settings', SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...stored };
  }
  async saveSettings(settings: Settings): Promise<void> {
    await this.db.put('settings', settings, SETTINGS_KEY);
  }

  listTemplates(): Promise<SessionTemplate[]> {
    return this.db.getAll('templates');
  }
  getTemplate(id: string): Promise<SessionTemplate | undefined> {
    return this.db.get('templates', id);
  }
  async saveTemplate(template: SessionTemplate): Promise<void> {
    await this.db.put('templates', template);
  }
  deleteTemplate(id: string): Promise<void> {
    return this.db.delete('templates', id);
  }

  async listExercises(): Promise<Exercise[]> {
    const all = await this.db.getAll('exercises');
    return all.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  async saveExercise(exercise: Exercise): Promise<void> {
    await this.db.put('exercises', exercise);
  }

  listCycles(): Promise<Cycle[]> {
    return this.db.getAllFromIndex('cycles', 'byStartDate');
  }
  getCycle(id: string): Promise<Cycle | undefined> {
    return this.db.get('cycles', id);
  }
  async saveCycle(cycle: Cycle): Promise<void> {
    await this.db.put('cycles', cycle);
  }
  deleteCycle(id: string): Promise<void> {
    return this.db.delete('cycles', id);
  }

  listSessionsBetween(from: IsoDate, to: IsoDate): Promise<Session[]> {
    return this.db.getAllFromIndex('sessions', 'byDate', IDBKeyRange.bound(from, to));
  }
  async listSessionsByCycle(cycleId: string): Promise<Session[]> {
    const sessions = await this.db.getAllFromIndex('sessions', 'byCycle', cycleId);
    return sessions.sort(byDate);
  }
  getSession(id: string): Promise<Session | undefined> {
    return this.db.get('sessions', id);
  }
  async saveSessions(sessions: readonly Session[]): Promise<void> {
    const tx = this.db.transaction('sessions', 'readwrite');
    await Promise.all([...sessions.map((s) => tx.store.put(s)), tx.done]);
  }
  deleteSession(id: string): Promise<void> {
    return this.db.delete('sessions', id);
  }

  async listMaxChanges(cycleId?: string): Promise<MaxChange[]> {
    const all =
      cycleId === undefined
        ? await this.db.getAll('maxChanges')
        : await this.db.getAllFromIndex('maxChanges', 'byCycle', cycleId);
    return all.sort((a, b) => a.at.localeCompare(b.at));
  }
  async addMaxChanges(changes: readonly MaxChange[]): Promise<void> {
    const tx = this.db.transaction('maxChanges', 'readwrite');
    await Promise.all([...changes.map((c) => tx.store.put(c)), tx.done]);
  }

  async applyChanges(changes: Changes): Promise<void> {
    const tx = this.db.transaction(['cycles', 'sessions', 'maxChanges'], 'readwrite');
    const sessions = tx.objectStore('sessions');
    const requests: Promise<unknown>[] = [];
    try {
      for (const c of changes.saveCycles ?? []) requests.push(tx.objectStore('cycles').put(c));
      for (const id of changes.deleteSessionIds ?? []) requests.push(sessions.delete(id));
      for (const s of changes.saveSessions ?? []) requests.push(sessions.put(s));
      for (const m of changes.addMaxChanges ?? []) requests.push(tx.objectStore('maxChanges').put(m));
      await Promise.all([...requests, tx.done]);
    } catch (err) {
      // Une erreur synchrone (clé invalide…) n'annule pas la transaction d'elle-même.
      for (const r of requests) r.catch(() => undefined);
      tx.done.catch(() => undefined);
      try {
        tx.abort();
      } catch {
        // déjà annulée
      }
      throw err;
    }
  }

  async getFlag(key: string): Promise<string | undefined> {
    const record = await this.db.get('meta', `flag:${key}`);
    return record === undefined ? undefined : String(record.value);
  }
  async setFlag(key: string, value: string): Promise<void> {
    await this.db.put('meta', { key: `flag:${key}`, value });
  }

  async ensureSeeded(): Promise<{ seeded: boolean }> {
    const tx = this.db.transaction(['meta', 'templates', 'exercises'], 'readwrite');
    const current = await tx.objectStore('meta').get('seedVersion');
    if (current && Number(current.value) >= SEED_VERSION) {
      await tx.done;
      return { seeded: false };
    }
    const { templates, exercises } = seedData();
    const templateStore = tx.objectStore('templates');
    const exerciseStore = tx.objectStore('exercises');
    for (const t of templates) {
      // Ne pas écraser un modèle natif déjà modifié par l'utilisateur.
      if (!(await templateStore.get(t.id))) await templateStore.put(t);
    }
    for (const e of exercises) {
      if (!(await exerciseStore.get(e.id))) await exerciseStore.put(e);
    }
    await tx.objectStore('meta').put({ key: 'seedVersion', value: SEED_VERSION });
    await tx.done;
    return { seeded: true };
  }

  close(): void {
    this.db.close();
  }
}

export async function openRepository(dbName: string = DB_NAME): Promise<Repository> {
  return new IdbRepository(await openCdfDb(dbName));
}

let shared: Promise<Repository> | undefined;

/** Instance partagée par l'application. */
export function getRepository(): Promise<Repository> {
  shared ??= openRepository();
  return shared;
}
