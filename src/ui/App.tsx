import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { getRepository } from '../data/repository';
import type { Repository } from '../data/repository';
import type { Settings } from '../domain/types';
import { AppContext } from './context';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { goBack, href, tabOf, useRoute } from './router';
import type { Route, Tab } from './router';
import { S } from './strings';
import { applyTheme } from './theme';
import { CalendarScreen } from './screens/CalendarScreen';
import { CycleScreen } from './screens/CycleScreen';
import { DuplicateCycleScreen } from './screens/DuplicateCycleScreen';
import { DuplicateWeekScreen } from './screens/DuplicateWeekScreen';
import { NewCycleScreen } from './screens/NewCycleScreen';
import { SessionScreen } from './screens/SessionScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { TodayScreen } from './screens/TodayScreen';

const TABS: { tab: Tab; icon: IconName; label: string; href: string }[] = [
  { tab: 'calendar', icon: 'calendar', label: S.nav.calendar, href: href.calendar() },
  { tab: 'today', icon: 'today', label: S.nav.today, href: href.today() },
  { tab: 'templates', icon: 'templates', label: S.nav.templates, href: href.templates() },
  { tab: 'stats', icon: 'stats', label: S.nav.stats, href: href.stats() },
];

const TITLES: Record<Route['name'], string> = {
  calendar: S.calendar.title,
  today: S.today.title,
  templates: S.templates.title,
  stats: S.stats.title,
  settings: S.settings.title,
  session: S.session.title,
  newCycle: S.cycleForm.newTitle,
  cycle: S.cycle.title,
  duplicateCycle: S.duplicateCycle.title,
  duplicateWeek: S.duplicateWeek.title,
};

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'calendar':
      return <CalendarScreen />;
    case 'today':
      return <TodayScreen />;
    case 'templates':
      return <TemplatesScreen />;
    case 'stats':
      return <StatsScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'session':
      return <SessionScreen id={route.id} />;
    case 'newCycle':
      return <NewCycleScreen />;
    case 'cycle':
      return <CycleScreen id={route.id} />;
    case 'duplicateCycle':
      return <DuplicateCycleScreen id={route.id} />;
    case 'duplicateWeek':
      return <DuplicateWeekScreen from={route.from} />;
  }
}

type Boot = { state: 'loading' } | { state: 'error' } | { state: 'ready'; repo: Repository; settings: Settings };

export function App() {
  const route = useRoute();
  const [boot, setBoot] = useState<Boot>({ state: 'loading' });
  const [dataVersion, setDataVersion] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

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

  const refresh = useCallback(() => setDataVersion((v) => v + 1), []);
  const toast = useCallback((message: string) => {
    setToastMessage(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMessage(null), 3500);
  }, []);

  if (boot.state !== 'ready') {
    return <p class="card" style={{ margin: 16 }}>{boot.state === 'loading' ? S.loading : S.loadError}</p>;
  }

  const updateSettings = async (patch: Partial<Settings>) => {
    const settings = { ...boot.settings, ...patch };
    await boot.repo.saveSettings(settings);
    setBoot({ ...boot, settings });
  };

  const tab = tabOf(route);
  const isTabRoot = route.name === tab;

  return (
    <AppContext.Provider value={{ repo: boot.repo, settings: boot.settings, updateSettings, dataVersion, refresh, toast }}>
      <div class="app">
        <header class="topbar">
          {!isTabRoot && (
            <button class="icon-btn" type="button" aria-label={S.menu.back} onClick={goBack}>
              <Icon name="back" />
            </button>
          )}
          <h1>{TITLES[route.name]}</h1>
          {route.name !== 'settings' && (
            <a class="icon-btn" href={href.settings()} aria-label={S.menu.settings} title={S.menu.settings}>
              <Icon name="menu" />
            </a>
          )}
        </header>
        <main>
          <Screen route={route} />
        </main>
        <div class="toast" role="status">
          {toastMessage}
        </div>
        <nav class="bottom-nav" aria-label={S.nav.label}>
          {TABS.map((t) => (
            <a key={t.tab} href={t.href} aria-current={tab === t.tab ? 'page' : undefined}>
              <Icon name={t.icon} />
              {t.label}
            </a>
          ))}
        </nav>
      </div>
    </AppContext.Provider>
  );
}
