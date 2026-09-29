import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import { migrateLegacyLifts } from '../domain/legacyLifts';
import type { Activity, Cycle, Exercise, MaxChange, Session, SessionTemplate, Settings } from '../domain/types';

export const DB_NAME = 'cycle-de-force';
export const DB_VERSION = 3;

export interface MetaRecord {
  key: string;
  value: string | number;
}

export interface CdfSchema extends DBSchema {
  templates: { key: string; value: SessionTemplate };
  exercises: { key: string; value: Exercise };
  cycles: { key: string; value: Cycle; indexes: { byStartDate: string } };
  sessions: { key: string; value: Session; indexes: { byDate: string; byCycle: string } };
  maxChanges: { key: string; value: MaxChange; indexes: { byCycle: string } };
  activities: { key: string; value: Activity; indexes: { byDate: string } };
  settings: { key: string; value: Settings };
  meta: { key: string; value: MetaRecord };
}

export type CdfDb = IDBPDatabase<CdfSchema>;
type UpgradeTx = IDBPTransaction<CdfSchema, StoreNames<CdfSchema>[], 'versionchange'>;

const DATA_STORES = ['templates', 'exercises', 'cycles', 'sessions', 'maxChanges'] as const;

/** Réécrit tout le contenu des stores de données au travers d'une transformation pure. */
async function rewriteData(tx: UpgradeTx, transform: (data: Record<(typeof DATA_STORES)[number], unknown[]>) => Record<string, unknown>) {
  const loaded = await Promise.all(DATA_STORES.map((name) => tx.objectStore(name).getAll()));
  const data = Object.fromEntries(DATA_STORES.map((name, i) => [name, loaded[i]])) as Record<(typeof DATA_STORES)[number], unknown[]>;
  const next = transform(data);
  for (const name of DATA_STORES) {
    const store = tx.objectStore(name);
    await store.clear();
    for (const value of (next[name] ?? []) as never[]) await store.put(value);
  }
}

interface Migration {
  /** Création de stores / index : synchrone, pendant que la transaction de mise à jour est active. */
  schema?: (db: CdfDb) => void;
  /** Réécriture des données : n'utilise que la transaction de mise à jour, sans rien attendre d'autre. */
  data?: (tx: UpgradeTx) => Promise<void>;
}

/**
 * Migrations versionnées : l'entrée N fait passer la base de N-1 à N. Tous les `schema` passent
 * d'abord (dans l'ordre), puis les `data` s'enchaînent : une donnée réécrite en v2 est ainsi déjà
 * dans une base qui a la structure finale.
 */
const MIGRATIONS: Record<number, Migration> = {
  1: {
    schema: (db) => {
      db.createObjectStore('templates', { keyPath: 'id' });
      db.createObjectStore('exercises', { keyPath: 'id' });
      db.createObjectStore('cycles', { keyPath: 'id' }).createIndex('byStartDate', 'startDate');
      const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
      sessions.createIndex('byDate', 'date');
      sessions.createIndex('byCycle', 'cycleId');
      db.createObjectStore('maxChanges', { keyPath: 'id' }).createIndex('byCycle', 'cycleId');
      db.createObjectStore('settings');
      db.createObjectStore('meta', { keyPath: 'key' });
    },
  },
  // 2 : RM par exercice (les % et les max ne sont plus limités à S/B/D).
  2: { data: (tx) => rewriteData(tx, migrateLegacyLifts) },
  // 3 : activités cardio (la branche perso 1.2.0 l'a numérotée 2 ; bases séparées, pas de conflit).
  3: {
    schema: (db) => {
      db.createObjectStore('activities', { keyPath: 'id' }).createIndex('byDate', 'date');
    },
  },
};

/** `version` : pour les tests de migration uniquement (ouvrir une base dans un état ancien). */
export function openCdfDb(name: string = DB_NAME, version: number = DB_VERSION): Promise<CdfDb> {
  return openDB<CdfSchema>(name, version, {
    upgrade(db, oldVersion, newVersion, tx) {
      const steps: Migration[] = [];
      for (let v = oldVersion + 1; v <= (newVersion ?? version); v++) {
        const migration = MIGRATIONS[v];
        if (!migration) throw new Error(`Migration manquante vers la version ${v}`);
        steps.push(migration);
      }
      for (const m of steps) m.schema?.(db);
      // La première réécriture démarre tout de suite, les suivantes s'enchaînent sans pause.
      let chain: Promise<void> | undefined;
      for (const { data } of steps) if (data) chain = chain ? chain.then(() => data(tx)) : data(tx);
      chain?.catch((err: unknown) => {
        console.error(err);
        tx.abort();
      });
    },
  });
}
