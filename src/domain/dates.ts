import type { IsoDate, Weekday } from './types';

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtc(date: IsoDate): Date {
  const m = ISO_RE.exec(date);
  if (!m) throw new Error(`Date invalide : ${date}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function fromUtc(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date du jour dans le fuseau local. */
export function todayIso(now: Date = new Date()): IsoDate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(date: IsoDate): Weekday {
  const day = toUtc(date).getUTCDay();
  return (day === 0 ? 7 : day) as Weekday;
}

export function mondayOf(date: IsoDate): IsoDate {
  return addDays(date, 1 - isoWeekday(date));
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}
