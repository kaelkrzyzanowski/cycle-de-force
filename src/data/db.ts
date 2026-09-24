import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import type { Cycle, Exercise, MaxChange, Session, SessionTemplate, Settings } from '../domain/types';

export const DB_NAME = 'cycle-de-force';
export const DB_VERSION = 1;

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

/** Migrations versionnées : l'entrée N fait passer la base de N-1 à N. */
const MIGRATIONS: Record<number, (db: CdfDb, tx: UpgradeTx) => void> = {
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
};

export function openCdfDb(name: string = DB_NAME): Promise<CdfDb> {
  return openDB<CdfSchema>(name, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, tx) {
      for (let v = oldVersion + 1; v <= (newVersion ?? DB_VERSION); v++) {
        const migrate = MIGRATIONS[v];
        if (!migrate) throw new Error(`Migration manquante vers la version ${v}`);
        migrate(db, tx);
      }
    },
  });
}
