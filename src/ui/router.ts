import { useEffect, useState } from 'preact/hooks';
import type { IsoDate } from '../domain/types';

export type Tab = 'calendar' | 'today' | 'templates' | 'stats';

export type Route =
  | { name: 'calendar' }
  | { name: 'today' }
  | { name: 'templates' }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'session'; id: string }
  | { name: 'newCycle' }
  | { name: 'cycle'; id: string }
  | { name: 'duplicateCycle'; id: string }
  | { name: 'duplicateWeek'; from: IsoDate | null };

export const href = {
  calendar: () => '#/calendrier',
  today: () => '#/aujourdhui',
  templates: () => '#/modeles',
  stats: () => '#/stats',
  settings: () => '#/reglages',
  session: (id: string) => `#/seance/${id}`,
  newCycle: () => '#/cycle/nouveau',
  cycle: (id: string) => `#/cycle/${id}`,
  duplicateCycle: (id: string) => `#/cycle/${id}/dupliquer`,
  duplicateWeek: (from?: IsoDate) => `#/semaine/dupliquer${from ? `/${from}` : ''}`,
};

export function parseRoute(hash: string): Route {
  const [head = '', a, b] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  switch (head) {
    case 'aujourdhui':
      return { name: 'today' };
    case 'modeles':
      return { name: 'templates' };
    case 'stats':
      return { name: 'stats' };
    case 'reglages':
      return { name: 'settings' };
    case 'seance':
      return a ? { name: 'session', id: a } : { name: 'calendar' };
    case 'cycle':
      if (a === 'nouveau') return { name: 'newCycle' };
      if (a && b === 'dupliquer') return { name: 'duplicateCycle', id: a };
      return a ? { name: 'cycle', id: a } : { name: 'calendar' };
    case 'semaine':
      return { name: 'duplicateWeek', from: b ?? null };
    default:
      return { name: 'calendar' };
  }
}

/** Onglet de la barre basse auquel appartient un écran. */
export function tabOf(route: Route): Tab | null {
  switch (route.name) {
    case 'calendar':
    case 'today':
    case 'templates':
    case 'stats':
      return route.name;
    case 'settings':
      return null;
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

/** Routage par hash : fonctionne hors ligne, sans serveur, et dans une WebView Capacitor. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash));
      scrollTo(0, 0);
    };
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
