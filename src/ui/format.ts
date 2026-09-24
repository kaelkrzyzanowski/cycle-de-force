import type { LoadRule } from '../domain/types';

const NBSP = ' ';
const kgFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function formatKg(kg: number): string {
  return kgFormat.format(kg);
}

/** Règle de charge lisible : « 70 % D », « +20 kg », « » pour une charge fixe. */
export function formatRule(rule: LoadRule): string {
  switch (rule.kind) {
    case 'PERCENT':
      return `${Math.round(rule.pct * 100)}${NBSP}%${NBSP}${rule.lift}`;
    case 'BODYWEIGHT':
      return rule.extraKg ? `PDC${NBSP}+${formatKg(rule.extraKg)}${NBSP}kg` : 'PDC';
    case 'FIXED':
    case 'NONE':
      return '';
  }
}
