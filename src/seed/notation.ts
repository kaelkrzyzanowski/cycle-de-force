import type { LoadRule, SetPrescription } from '../domain/types';

const CHUNK_RE = /^(?:(\d+)\s*[x×]\s*)?(\d+)\s*(?:@\s*(.+))?$/;
const NUM = '(\\d+(?:[.,]\\d+)?)';
const PERCENT_RE = new RegExp(`^${NUM}\\s*%\\s*([SBD])$`);
const BODYWEIGHT_RE = new RegExp(`^\\+\\s*${NUM}$`);
const FIXED_RE = new RegExp(`^${NUM}$`);

const num = (s: string): number => Number(s.replace(',', '.'));

function parseLoad(text: string | undefined): LoadRule {
  if (text === undefined) return { kind: 'NONE' };
  const t = text.trim();
  let m = PERCENT_RE.exec(t);
  if (m?.[1] && m[2]) {
    return { kind: 'PERCENT', lift: m[2] as 'S' | 'B' | 'D', pct: Math.round(num(m[1]) * 100) / 10_000 };
  }
  m = BODYWEIGHT_RE.exec(t);
  if (m?.[1]) return { kind: 'BODYWEIGHT', extraKg: num(m[1]) };
  m = FIXED_RE.exec(t);
  if (m?.[1]) return { kind: 'FIXED', kg: num(m[1]) };
  throw new Error(`Charge illisible : « ${text} »`);
}

/**
 * Notation du cahier : « 3x4@70%D » (3 séries de 4 à 70 % du max D), « 4@85%D, 3x3@90%D »,
 * « 3x8@80 » (charge fixe), « 3x8@+20 » (lest), « 2x1 » (charge à saisir).
 */
export function parseSets(notation: string): SetPrescription[] {
  // Séparateur : virgule suivie d'un espace, ou point-virgule (« 22,5 » reste un décimal).
  return notation.split(/,\s+|;/).flatMap((raw) => {
    const m = CHUNK_RE.exec(raw.trim());
    if (!m?.[2]) throw new Error(`Notation illisible : « ${raw} »`);
    const count = m[1] ? Number(m[1]) : 1;
    const reps = Number(m[2]);
    const load = parseLoad(m[3]);
    return Array.from({ length: count }, () => ({ reps, load: { ...load } }));
  });
}
