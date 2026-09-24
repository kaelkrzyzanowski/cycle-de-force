import { useEffect, useState } from 'preact/hooks';
import { getRepository } from '../data/repository';
import type { Repository } from '../data/repository';
import type { Settings } from '../domain/types';
import { AppContext } from './context';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { PATHS, useRoute } from './router';
import type { Route } from './router';
import { S } from './strings';
import { applyTheme } from './theme';
import { CalendarScreen } from './screens/CalendarScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { TodayScreen } from './screens/TodayScreen';

const TABS: { route: Route; icon: IconName; label: string }[] = [
  { route: 'calendar', icon: 'calendar', label: S.nav.calendar },
  { route: 'today', icon: 'today', label: S.nav.today },
  { route: 'templates', icon: 'templates', label: S.nav.templates },
  { route: 'stats', icon: 'stats', label: S.nav.stats },
];

const TITLES: Record<Route, string> = {
  calendar: S.calendar.title,
  today: S.today.title,
  templates: S.templates.title,
  stats: S.stats.title,
  settings: S.settings.title,
};

type Boot = { state: 'loading' } | { state: 'error' } | { state: 'ready'; repo: Repository; settings: Settings };

export function App() {
  const route = useRoute();
  const [boot, setBoot] = useState<Boot>({ state: 'loading' });

  useEffect(() => {
    (async () => {
      const repo = await getRepository();
      await repo.ensureSeeded();
      setBoot({ state: 'ready', repo, settings: await repo.getSettings() });
    })().catch((err: unknown) => {
      console.error(err);
      setBoot({ state: 'error' });
    });
  }, []);

  const theme = boot.state === 'ready' ? boot.settings.theme : 'dark';
  useEffect(() => applyTheme(theme), [theme]);

  if (boot.state !== 'ready') {
    return <p class="card" style={{ margin: 16 }}>{boot.state === 'loading' ? S.loading : S.loadError}</p>;
  }

  const updateSettings = async (patch: Partial<Settings>) => {
    const settings = { ...boot.settings, ...patch };
    await boot.repo.saveSettings(settings);
    setBoot({ ...boot, settings });
  };

  return (
    <AppContext.Provider value={{ repo: boot.repo, settings: boot.settings, updateSettings }}>
      <div class="app">
        <header class="topbar">
          {route === 'settings' && (
            <button class="icon-btn" type="button" aria-label={S.menu.back} onClick={() => (history.length > 1 ? history.back() : (location.hash = PATHS.calendar))}>
              <Icon name="back" />
            </button>
          )}
          <h1>{TITLES[route]}</h1>
          {route !== 'settings' && (
            <a class="icon-btn" href={PATHS.settings} aria-label={S.menu.settings} title={S.menu.settings}>
              <Icon name="menu" />
            </a>
          )}
        </header>
        <main>
          {route === 'calendar' && <CalendarScreen />}
          {route === 'today' && <TodayScreen />}
          {route === 'templates' && <TemplatesScreen />}
          {route === 'stats' && <StatsScreen />}
          {route === 'settings' && <SettingsScreen />}
        </main>
        <nav class="bottom-nav" aria-label={S.nav.label}>
          {TABS.map((tab) => (
            <a key={tab.route} href={PATHS[tab.route]} aria-current={route === tab.route ? 'page' : undefined}>
              <Icon name={tab.icon} />
              {tab.label}
            </a>
          ))}
        </nav>
      </div>
    </AppContext.Provider>
  );
}
