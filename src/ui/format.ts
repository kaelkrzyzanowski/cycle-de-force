import type { IsoDate, LoadRule, MaxId } from '../domain/types';

const NBSP = ' ';
const kgFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const intFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatKg(kg: number): string {
  return kgFormat.format(kg);
}

/** 0.725 → « 72,5 » */
export function formatPct(pct: number): string {
  return formatKg(Math.round(pct * 1000) / 10);
}

export function formatTonnage(kg: number): string {
  return `${intFormat.format(kg)}${NBSP}kg`;
}

/** Règle de charge lisible : « 70 % S », « PDC +20 kg », « » pour une charge fixe. */
export function formatRule(rule: LoadRule, maxName: (id: MaxId) => string): string {
  switch (rule.kind) {
    case 'PERCENT':
      return `${formatPct(rule.pct)}${NBSP}%${NBSP}${maxName(rule.of)}`;
    case 'BODYWEIGHT':
      return rule.extraKg ? `PDC${NBSP}+${formatKg(rule.extraKg)}${NBSP}kg` : 'PDC';
    case 'FIXED':
    case 'NONE':
      return '';
  }
}

const utc = (iso: IsoDate): Date => new Date(`${iso}T00:00:00Z`);
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' });

const dayLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const dayMedium = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const dayShort = fmt({ day: 'numeric', month: 'short' });
const monthYear = fmt({ month: 'long', year: 'numeric' });

export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** « Mardi 22 septembre » */
export const formatDayLong = (iso: IsoDate): string => capitalize(dayLong.format(utc(iso)));
/** « mar. 22 sept. » */
export const formatDayMedium = (iso: IsoDate): string => dayMedium.format(utc(iso));
/** « 22 sept. » */
export const formatDayShort = (iso: IsoDate): string => dayShort.format(utc(iso));
/** « Septembre 2026 » */
export const formatMonthYear = (iso: IsoDate): string => capitalize(monthYear.format(utc(iso)));

/** « 21 – 27 sept. » ou « 28 sept. – 4 oct. » */
export function formatRange(from: IsoDate, to: IsoDate): string {
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))}${NBSP}–${NBSP}${formatDayShort(to)}`;
  return `${formatDayShort(from)}${NBSP}–${NBSP}${formatDayShort(to)}`;
}

/** Lit un nombre saisi au clavier français (« 172,5 »). */
export function parseDecimal(text: string): number | null {
  const n = Number(text.replace(',', '.').replace(/\s/g, ''));
  return text.trim() === '' || !Number.isFinite(n) ? null : n;
}
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Chronomètre : « 12:34.5 » (ou « 1:12:34.5 » à partir d'une heure). */
export function formatStopwatch(ms: number): string {
  const centis = Math.floor((ms % 1000) / 100);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const base = h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  return `${base}.${centis}`;
}
