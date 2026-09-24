import type { IsoDate, LoadRule } from '../domain/types';

const NBSP = ' ';
const kgFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const intFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatKg(kg: number): string {
  return kgFormat.format(kg);
}

export function formatTonnage(kg: number): string {
  return `${intFormat.format(kg)}${NBSP}kg`;
}

/** Règle de charge lisible : « 70 % D », « PDC +20 kg », « » pour une charge fixe. */
export function formatRule(rule: LoadRule): string {
  switch (rule.kind) {
    case 'PERCENT':
      return `${formatKg(Math.round(rule.pct * 1000) / 10)}${NBSP}%${NBSP}${rule.lift}`;
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

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

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
