import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { getRepository } from '../data/repository';
import type { Repository } from '../data/repository';
import type { Settings } from '../domain/types';
import { isNative, loadNative } from '../platform';
import { runAutoBackup } from './backupIO';
import { AppContext } from './context';
import { countdown, installCountdownAlarm } from './countdownStore';
import type { ToastAction } from './context';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { goBack, href, navigate, tabOf, useRoute } from './router';
import type { Route, Tab } from './router';
import { S } from './strings';
import { applyTheme } from './theme';
import { CalendarScreen } from './screens/CalendarScreen';
import { ChronoScreen } from './screens/ChronoScreen';
import { CycleScreen } from './screens/CycleScreen';
import { DuplicateCycleScreen } from './screens/DuplicateCycleScreen';
import { DuplicateWeekScreen } from './screens/DuplicateWeekScreen';
import { JournalScreen } from './screens/JournalScreen';
import { NewCycleScreen } from './screens/NewCycleScreen';
import { SessionScreen } from './screens/SessionScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TemplateEditorScreen } from './screens/TemplateEditorScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { TodayScreen } from './screens/TodayScreen';
import { TrackScreen } from './screens/TrackScreen';
import { installStepsSync } from './stepsSync';
import { recording, resumeRecording } from './trackStore';

const TABS: { tab: Tab; icon: IconName; label: string; href: string }[] = [
  { tab: 'calendar', icon: 'calendar', label: S.nav.calendar, href: href.calendar() },
  { tab: 'today', icon: 'today', label: S.nav.today, href: href.today() },
  { tab: 'chrono', icon: 'chrono', label: S.nav.chrono, href: href.chrono() },
  { tab: 'journal', icon: 'journal', label: S.nav.journal, href: href.journal() },
  { tab: 'templates', icon: 'templates', label: S.nav.templates, href: href.templates() },
  { tab: 'stats', icon: 'stats', label: S.nav.stats, href: href.stats() },
];

const TITLES: Record<Route['name'], string> = {
  calendar: S.calendar.title,
  today: S.today.title,
  chrono: S.chrono.title,
  templates: S.templates.title,
  stats: S.stats.title,
  journal: S.journal.title,
  settings: S.settings.title,
  session: S.session.title,
  newCycle: S.cycleForm.newTitle,
  cycle: S.cycle.title,
  duplicateCycle: S.duplicateCycle.title,
  duplicateWeek: S.duplicateWeek.title,
  template: S.templateEditor.title,
  track: S.track.title,
};

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'calendar':
      return <CalendarScreen />;
    case 'today':
      return <TodayScreen />;
    case 'chrono':
      return <ChronoScreen />;
    case 'templates':
      return <TemplatesScreen />;
    case 'stats':
      return <StatsScreen />;
    case 'journal':
      return <JournalScreen />;
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
    case 'template':
      return <TemplateEditorScreen id={route.id} />;
    case 'track':
      return <TrackScreen />;
  }
}

type Boot = { state: 'loading' } | { state: 'error' } | { state: 'ready'; repo: Repository; settings: Settings };

export function App() {
  const route = useRoute();
  const [boot, setBoot] = useState<Boot>({ state: 'loading' });
  const [dataVersion, setDataVersion] = useState(0);
  const [toastState, setToastState] = useState<{ message: string; action?: ToastAction } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const repo = await getRepository();
      await repo.ensureSeeded();
      setBoot({ state: 'ready', repo, settings: await repo.getSettings() });
      // Activité GPS en cours au lancement (app relancée depuis la notification…) : on la rouvre.
      resumeRecording();
      if (recording.get() && !recording.get()?.finished && (location.hash === '' || location.hash === '#/')) navigate(href.track(), true);
      if (isNative) {
        // Copie automatique au lancement, puis à chaque passage en arrière-plan (fin de séance, verrouillage…).
        void runAutoBackup(repo);
        void loadNative().then((native) => {
          native.onAppStateChange((active) => !active && void runAutoBackup(repo));
          installStepsSync(repo, () => setDataVersion((v) => v + 1), native.onAppStateChange);
        });
      }
    })().catch((err: unknown) => {
      console.error(err);
      setBoot({ state: 'error' });
    });
  }, []);

  const theme = boot.state === 'ready' ? boot.settings.theme : 'dark';
  const palette = boot.state === 'ready' ? boot.settings.palette : 'rouge';
  useEffect(() => applyTheme(theme, palette), [theme, palette]);

  const refresh = useCallback(() => setDataVersion((v) => v + 1), []);
  const toast = useCallback((message: string, action?: ToastAction) => {
    setToastState({ message, action });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastState(null), action ? 6000 : 3500);
  }, []);

  useEffect(() => installCountdownAlarm(), []);
  // Le minuteur sonne aussi depuis les autres onglets : on le signale.
  const onChrono = route.name === 'chrono';
  useEffect(() => (onChrono ? undefined : countdown.onDone(() => toast(S.chrono.timerDone))), [onChrono, toast]);

  if (boot.state === 'loading') {
    return (
      <div class="splash" role="status">
        <img src="icons/favicon.png" alt="" />
        <span>{S.appName}</span>
      </div>
    );
  }
  if (boot.state === 'error') {
    return <p class="card" style={{ margin: 16 }}>{S.loadError}</p>;
  }

  const updateSettings = async (patch: Partial<Settings>) => {
    const settings = { ...boot.settings, ...patch };
    await boot.repo.saveSettings(settings);
    setBoot({ ...boot, settings });
  };
  const reloadSettings = async () => {
    setBoot({ ...boot, settings: await boot.repo.getSettings() });
  };

  const tab = tabOf(route);
  const isTabRoot = route.name === tab;

  return (
    <AppContext.Provider
      value={{ repo: boot.repo, settings: boot.settings, updateSettings, reloadSettings, dataVersion, refresh, toast }}
    >
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
        <div class={`toast${toastState ? '' : ' is-hidden'}`} role="status">
          {toastState && <span>{toastState.message}</span>}
          {toastState?.action && (
            <button
              type="button"
              class="toast-action"
              onClick={() => {
                toastState.action?.run();
                setToastState(null);
              }}
            >
              {toastState.action.label}
            </button>
          )}
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
