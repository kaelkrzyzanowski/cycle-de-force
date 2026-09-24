import { useEffect, useState } from 'preact/hooks';
import type { Rounding, ThemePref } from '../../domain/types';
import { useApp } from '../context';
import { formatKg } from '../format';
import { S } from '../strings';

const THEMES: ThemePref[] = ['dark', 'light', 'system'];
const ROUNDINGS: Rounding[] = [0, 0.5, 1, 1.25, 2.5];

type Persisted = 'yes' | 'no' | 'unknown';

export function SettingsScreen() {
  const { settings, updateSettings } = useApp();
  const [persisted, setPersisted] = useState<Persisted>('unknown');

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then((p) => setPersisted(p ? 'yes' : 'no'))
      .catch(() => setPersisted('unknown'));
  }, []);

  return (
    <div class="stack">
      <section class="card field">
        <span id="theme-label">{S.settings.theme}</span>
        <div class="segmented" role="group" aria-labelledby="theme-label">
          {THEMES.map((t) => (
            <button key={t} type="button" aria-pressed={settings.theme === t} onClick={() => updateSettings({ theme: t })}>
              {S.settings.themes[t]}
            </button>
          ))}
        </div>
      </section>

      <section class="card field">
        <span id="rounding-label">{S.settings.rounding}</span>
        <div class="segmented" role="group" aria-labelledby="rounding-label">
          {ROUNDINGS.map((r) => (
            <button
              key={r}
              type="button"
              class="num"
              aria-pressed={settings.rounding === r}
              onClick={() => updateSettings({ rounding: r })}
            >
              {r === 0 ? S.settings.roundingNone : formatKg(r)}
            </button>
          ))}
        </div>
      </section>

      <section class="card field">
        <span>{S.settings.storage}</span>
        <p class="muted" style={{ margin: 0 }}>
          {persisted === 'yes'
            ? S.settings.storagePersisted
            : persisted === 'no'
              ? S.settings.storageNotPersisted
              : S.settings.storageUnknown}
        </p>
      </section>

      <p class="muted">{S.settings.version(__APP_VERSION__)}</p>
    </div>
  );
}
