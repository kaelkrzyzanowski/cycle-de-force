import { isRealized } from './load';
import { DEFAULT_SETTINGS } from './types';
import type { Cycle, Exercise, IsoDate, MaxChange, Session, SessionTemplate, Settings } from './types';

export const BACKUP_APP = 'cycle-de-force';
/** Version du format de fichier. À incrémenter avec une migration dans BACKUP_MIGRATIONS. */
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupData {
  settings: Settings;
  templates: SessionTemplate[];
  exercises: Exercise[];
  cycles: Cycle[];
  sessions: Session[];
  maxChanges: MaxChange[];
}

export interface BackupCounts {
  cycles: number;
  sessions: number;
  realizedSets: number;
  templates: number;
  exercises: number;
  maxChanges: number;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  counts: BackupCounts;
  data: BackupData;
}

export function countBackup(data: BackupData): BackupCounts {
  return {
    cycles: data.cycles.length,
    sessions: data.sessions.length,
    realizedSets: data.sessions.reduce(
      (n, s) => n + s.exercises.reduce((m, e) => m + e.sets.filter((x) => isRealized(x.status)).length, 0),
      0,
    ),
    templates: data.templates.length,
    exercises: data.exercises.length,
    maxChanges: data.maxChanges.length,
  };
}

export function buildBackup(data: BackupData, exportedAt: string): BackupFile {
  return { app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt, counts: countBackup(data), data };
}

export function backupFileName(date: IsoDate): string {
  return `cycle-de-force-${date}.json`;
}

// ——— Lecture et validation ———

type Json = Record<string, unknown>;
export type Migration = (file: Json) => Json;

/** Migrations du format : l'entrée N transforme un fichier de version N-1 en version N. */
export const BACKUP_MIGRATIONS: Record<number, Migration> = {};

export type BackupError = 'NOT_JSON' | 'WRONG_APP' | 'TOO_NEW' | 'INVALID';

export type ParseResult =
  | { ok: true; backup: BackupFile; migratedFrom: number | null }
  | { ok: false; error: BackupError; detail?: string };

class Invalid extends Error {}

const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LIFT = new Set(['S', 'B', 'D']);
const STATUS = new Set(['PLANNED', 'VALIDATED', 'FAILED', 'NOT_DONE', 'CLUSTER']);

function check(cond: boolean, what: string): asserts cond {
  if (!cond) throw new Invalid(what);
}
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const optNum = (v: unknown) => v === undefined || isNum(v);
const optStr = (v: unknown) => v === undefined || isStr(v);

function checkLoad(v: unknown, where: string): void {
  check(isRecord(v), `${where} : règle de charge`);
  switch (v['kind']) {
    case 'FIXED':
      check(isNum(v['kg']), `${where} : charge fixe`);
      return;
    case 'PERCENT':
      check(LIFT.has(String(v['lift'])) && isNum(v['pct']), `${where} : pourcentage`);
      return;
    case 'BODYWEIGHT':
      check(optNum(v['extraKg']), `${where} : lest`);
      return;
    case 'NONE':
      return;
    default:
      throw new Invalid(`${where} : type de charge inconnu`);
  }
}

function checkArray(data: Json, key: string, item: (v: Json, where: string) => void): void {
  const list = data[key];
  check(Array.isArray(list), `${key} manquant`);
  list.forEach((v, i) => {
    const where = `${key}[${i}]`;
    check(isRecord(v) && isStr(v['id']), `${where} : identifiant`);
    item(v, where);
  });
}

function checkMaxes(v: unknown, where: string): void {
  check(isRecord(v) && isNum(v['S']) && isNum(v['B']) && isNum(v['D']), `${where} : max`);
}

function checkData(data: unknown): asserts data is BackupData {
  check(isRecord(data), 'données absentes');
  check(isRecord(data['settings']), 'réglages absents');

  checkArray(data, 'templates', (t, w) => {
    check(isStr(t['name']) && isNum(t['weeksCount']) && isRecord(t['weeks']), w);
    for (const week of Object.values(t['weeks'] as Json)) {
      check(Array.isArray(week), `${w} : semaine`);
      for (const ex of week) {
        check(isRecord(ex) && isStr(ex['exerciseId']) && isStr(ex['name']) && Array.isArray(ex['sets']), `${w} : exercice`);
        for (const s of ex['sets'] as unknown[]) {
          check(isRecord(s) && isNum(s['reps']), `${w} : série`);
          checkLoad(s['load'], w);
        }
      }
    }
  });
  checkArray(data, 'exercises', (e, w) => check(isStr(e['name']) && Array.isArray(e['aliases']), w));
  checkArray(data, 'cycles', (c, w) => {
    check(isStr(c['name']) && isStr(c['startDate']) && ISO_DATE.test(c['startDate']) && isNum(c['weeksCount']), w);
    checkMaxes(c['max'], w);
    check(Array.isArray(c['weeklyPlan']), `${w} : planning`);
  });
  checkArray(data, 'sessions', (s, w) => {
    check(isStr(s['date']) && ISO_DATE.test(s['date']) && isStr(s['name']) && Array.isArray(s['exercises']), w);
    check(s['cycleId'] === null || isStr(s['cycleId']), `${w} : cycle`);
    for (const ex of s['exercises'] as unknown[]) {
      check(isRecord(ex) && isStr(ex['id']) && isStr(ex['name']) && Array.isArray(ex['sets']), `${w} : exercice`);
      for (const set of ex['sets'] as unknown[]) {
        check(isRecord(set) && isNum(set['index']) && isNum(set['plannedReps']) && STATUS.has(String(set['status'])), `${w} : série`);
        check(optNum(set['actualReps']) && optNum(set['actualKg']), `${w} : réalisé`);
        checkLoad(set['load'], w);
      }
      check(optNum(ex['rir']) && optStr(ex['note']), `${w} : RIR / note`);
    }
  });
  checkArray(data, 'maxChanges', (m, w) => {
    check(isStr(m['cycleId']) && LIFT.has(String(m['lift'])) && isNum(m['from']) && isNum(m['to']) && isStr(m['at']), w);
  });
}

export function parseBackup(
  text: string,
  options: { currentVersion?: number; migrations?: Record<number, Migration> } = {},
): ParseResult {
  const currentVersion = options.currentVersion ?? BACKUP_SCHEMA_VERSION;
  const migrations = options.migrations ?? BACKUP_MIGRATIONS;

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'NOT_JSON' };
  }
  if (!isRecord(raw) || raw['app'] !== BACKUP_APP) return { ok: false, error: 'WRONG_APP' };
  const version = raw['schemaVersion'];
  if (!isNum(version) || !Number.isInteger(version) || version < 1) return { ok: false, error: 'INVALID', detail: 'schemaVersion' };
  if (version > currentVersion) return { ok: false, error: 'TOO_NEW' };

  try {
    let file: Json = raw;
    for (let v = version + 1; v <= currentVersion; v++) {
      const migrate = migrations[v];
      if (!migrate) throw new Invalid(`migration ${v} manquante`);
      file = { ...migrate(file), schemaVersion: v };
    }
    const data = file['data'];
    checkData(data);
    const settings: Settings = { ...DEFAULT_SETTINGS, ...data.settings };
    const normalized: BackupData = { ...data, settings };
    return {
      ok: true,
      migratedFrom: version < currentVersion ? version : null,
      backup: {
        app: BACKUP_APP,
        schemaVersion: currentVersion,
        exportedAt: isStr(file['exportedAt']) ? file['exportedAt'] : '',
        counts: countBackup(normalized),
        data: normalized,
      },
    };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, error: 'INVALID', detail: err.message };
    throw err;
  }
}
