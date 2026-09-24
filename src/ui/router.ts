import { useEffect, useState } from 'preact/hooks';

export type Route = 'calendar' | 'today' | 'templates' | 'stats' | 'settings';

const ROUTES: Record<string, Route> = {
  calendrier: 'calendar',
  aujourdhui: 'today',
  modeles: 'templates',
  stats: 'stats',
  reglages: 'settings',
};

export const PATHS: Record<Route, string> = {
  calendar: '#/calendrier',
  today: '#/aujourdhui',
  templates: '#/modeles',
  stats: '#/stats',
  settings: '#/reglages',
};

function parse(hash: string): Route {
  return ROUTES[hash.replace(/^#\/?/, '').split('/')[0] ?? ''] ?? 'calendar';
}

/** Routage par hash : fonctionne hors ligne, sans serveur, et dans une WebView Capacitor. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash));
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
