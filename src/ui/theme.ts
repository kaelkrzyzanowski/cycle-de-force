import type { ThemePref } from '../domain/types';

const query = (): MediaQueryList => matchMedia('(prefers-color-scheme: light)');

function resolve(pref: ThemePref): 'dark' | 'light' {
  if (pref === 'system') return query().matches ? 'light' : 'dark';
  return pref;
}

/** Applique le thème et suit le système si demandé ; renvoie la fonction de nettoyage. */
export function applyTheme(pref: ThemePref): () => void {
  const set = () => {
    const theme = resolve(pref);
    document.documentElement.dataset['theme'] = theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  };
  set();
  if (pref !== 'system') return () => {};
  const mq = query();
  mq.addEventListener('change', set);
  return () => mq.removeEventListener('change', set);
}
