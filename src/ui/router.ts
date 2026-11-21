import { useEffect, useState } from 'preact/hooks';
import type { IsoDate } from '../domain/types';

export type Tab = 'calendar' | 'today' | 'chrono' | 'journal' | 'templates' | 'stats';

export type Route =
  | { name: 'calendar' }
  | { name: 'today' }
  | { name: 'chrono' }
  | { name: 'templates' }
  | { name: 'stats' }
  | { name: 'journal' }
  | { name: 'settings' }
  | { name: 'track' }
  | { name: 'session'; id: string }
  | { name: 'newCycle' }
  | { name: 'cycle'; id: string }
  | { name: 'duplicateCycle'; id: string }
  | { name: 'duplicateWeek'; from: IsoDate | null }
  | { name: 'template'; id: string };

export const href = {
  calendar: () => '#/calendrier',
  today: () => '#/aujourdhui',
  chrono: () => '#/chrono',
  templates: () => '#/modeles',
  stats: () => '#/stats',
  journal: () => '#/journal',
  settings: () => '#/reglages',
  track: () => '#/activite',
  session: (id: string) => `#/seance/${id}`,
  newCycle: () => '#/cycle/nouveau',
  cycle: (id: string) => `#/cycle/${id}`,
  duplicateCycle: (id: string) => `#/cycle/${id}/dupliquer`,
  duplicateWeek: (from?: IsoDate) => `#/semaine/dupliquer${from ? `/${from}` : ''}`,
  template: (id: string) => `#/modele/${encodeURIComponent(id)}`,
};

export function parseRoute(hash: string): Route {
  const [head = '', a, b] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  switch (head) {
    case 'aujourdhui':
      return { name: 'today' };
    case 'chrono':
      return { name: 'chrono' };
    case 'modeles':
      return { name: 'templates' };
    case 'stats':
      return { name: 'stats' };
    case 'journal':
      return { name: 'journal' };
    case 'reglages':
      return { name: 'settings' };
    case 'activite':
      return { name: 'track' };
    case 'seance':
      return a ? { name: 'session', id: a } : { name: 'calendar' };
    case 'cycle':
      if (a === 'nouveau') return { name: 'newCycle' };
      if (a && b === 'dupliquer') return { name: 'duplicateCycle', id: a };
      return a ? { name: 'cycle', id: a } : { name: 'calendar' };
    case 'semaine':
      return { name: 'duplicateWeek', from: b ?? null };
    case 'modele':
      return a ? { name: 'template', id: a } : { name: 'templates' };
    default:
      return { name: 'calendar' };
  }
}

/** Onglet de la barre basse auquel appartient un écran. */
export function tabOf(route: Route): Tab | null {
  switch (route.name) {
    case 'calendar':
    case 'today':
    case 'chrono':
    case 'templates':
    case 'stats':
    case 'journal':
      return route.name;
    case 'settings':
      return null;
    case 'template':
      return 'templates';
    case 'track':
      return 'today';
    default:
      return 'calendar';
  }
}

export function navigate(to: string, replace = false): void {
  if (replace) location.replace(to);
  else location.hash = to;
}

/** Retour arrière, ou le calendrier si l'écran a été ouvert directement. */
export function goBack(): void {
  if (history.length > 1) history.back();
  else navigate(href.calendar(), true);
}

/** Garde de sortie d'un écran (modifications non enregistrées) : renvoie faux pour rester sur place. */
type LeaveGuard = (to: string) => boolean;
let leaveGuard: LeaveGuard | null = null;
let currentHash = location.hash;

/** Installe (ou retire avec null) la garde de sortie ; renvoie la fonction qui la retire. */
export function setLeaveGuard(guard: LeaveGuard | null): () => void {
  leaveGuard = guard;
  return () => {
    if (leaveGuard === guard) leaveGuard = null;
  };
}

/** Routage par hash : fonctionne hors ligne, sans serveur, et dans une WebView Capacitor. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => {
      const to = location.hash;
      if (to === currentHash) return;
      if (leaveGuard && !leaveGuard(to)) {
        // On reste : l'adresse revient à l'écran courant, sans le recharger.
        location.replace(currentHash || '#/');
        return;
      }
      currentHash = to;
      setRoute(parseRoute(to));
      scrollTo(0, 0);
    };
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
