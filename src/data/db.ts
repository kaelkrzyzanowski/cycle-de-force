import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import { migrateLegacyLifts } from '../domain/legacyLifts';
import type { Cycle, Exercise, MaxChange, Session, SessionTemplate, Settings } from '../domain/types';

export const DB_NAME = 'cycle-de-force';
export const DB_VERSION = 2;

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

/**
 * Migrations versionnées : l'entrée N fait passer la base de N-1 à N. Une migration asynchrone
 * n'utilise que la transaction de mise à jour, sans rien attendre d'autre (sinon elle se ferme).
 */
const MIGRATIONS: Record<number, (db: CdfDb, tx: UpgradeTx) => void | Promise<void>> = {
  1: (db) => {
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
  // 2 : RM par exercice (les % et les max ne sont plus limités à S/B/D).
  2: (_db, tx) => rewriteData(tx, migrateLegacyLifts),
};

/** `version` : pour les tests de migration uniquement (ouvrir une base dans un état ancien). */
export function openCdfDb(name: string = DB_NAME, version: number = DB_VERSION): Promise<CdfDb> {
  return openDB<CdfSchema>(name, version, {
    upgrade(db, oldVersion, newVersion, tx) {
      // Synchrones tant que possible (création des stores), puis enchaînées sans pause : la
      // transaction reste ouverte tant qu'une requête est en cours.
      let chain: Promise<void> | undefined;
      for (let v = oldVersion + 1; v <= (newVersion ?? version); v++) {
        const migrate = MIGRATIONS[v];
        if (!migrate) throw new Error(`Migration manquante vers la version ${v}`);
        chain = chain ? chain.then(() => migrate(db, tx)) : (migrate(db, tx) ?? undefined);
      }
      chain?.catch((err: unknown) => {
        console.error(err);
        tx.abort();
      });
    },
  });
}
