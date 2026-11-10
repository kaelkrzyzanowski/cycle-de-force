import { useEffect, useState } from 'preact/hooks';
import type { Palette, Profile, Rounding, ThemePref } from '../../domain/types';
import { errorCode, Tracker } from '../../platform/tracker';
import type { StepStatus } from '../../platform/tracker';
import { BackupSection } from '../components/BackupSection';
import { NumberField } from '../components/NumberField';
import { useApp } from '../context';
import { formatKg } from '../format';
import { S } from '../strings';

const THEMES: ThemePref[] = ['dark', 'light', 'system'];
const PALETTES: { id: Palette; swatch: string }[] = [
  { id: 'rouge', swatch: '#c10e0f' },
  { id: 'glacier', swatch: '#4cc2ff' },
];
const ROUNDINGS: Rounding[] = [0, 0.5, 1, 1.25, 2.5];

type Persisted = 'yes' | 'no' | 'unknown';

const SEXES: Profile['sex'][] = ['M', 'F', 'NA'];

/** Âge, taille, poids et sexe : base de l'estimation des calories. */
function ProfileSettings() {
  const { settings, updateSettings } = useApp();
  const profile: Profile = settings.profile ?? { sex: 'NA', ageYears: 0, heightCm: 0, weightKg: 0 };
  const set = (patch: Partial<Profile>) => void updateSettings({ profile: { ...profile, ...patch } });

  return (
    <section class="card stack tight">
      <h2 class="card-title">{S.profile.title}</h2>
      <p class="muted" style={{ margin: 0 }}>
        {S.profile.hint}
      </p>
      <div class="button-row start">
        <NumberField label={S.profile.age} value={profile.ageYears} onChange={(ageYears) => set({ ageYears })} max={120} suffix="ans" buttons={false} />
        <NumberField label={S.profile.height} value={profile.heightCm} onChange={(heightCm) => set({ heightCm })} max={250} suffix="cm" buttons={false} />
        <NumberField label={S.profile.weight} value={profile.weightKg} onChange={(weightKg) => set({ weightKg })} max={300} suffix="kg" buttons={false} />
      </div>
      <span id="sex-label">{S.profile.sex}</span>
      <div class="segmented" role="group" aria-labelledby="sex-label">
        {SEXES.map((sex) => (
          <button key={sex} type="button" aria-pressed={profile.sex === sex} onClick={() => set({ sex })}>
            {S.profile.sexes[sex]}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Podomètre (app Android) : marche / arrêt du comptage en arrière-plan et objectif quotidien. */
function StepsSettings() {
  const { settings, updateSettings, toast } = useApp();
  const [status, setStatus] = useState<StepStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void Tracker.stepStatus().then(setStatus, () => undefined);
  }, []);
  if (!status?.available) return null;

  const toggle = async (on: boolean) => {
    setMessage(null);
    try {
      if (on) await Tracker.startSteps();
      else await Tracker.stopSteps();
      setStatus(await Tracker.stepStatus());
      toast(on ? S.steps.enabled : S.steps.disabled);
    } catch (err) {
      setMessage(errorCode(err) === 'NO_SENSOR' ? S.steps.noSensor : S.steps.denied);
    }
  };

  return (
    <section class="card stack tight">
      <h2 class="card-title">{S.steps.tracking}</h2>
      <label class="switch-row">
        <input type="checkbox" checked={status.enabled} onChange={(e) => void toggle(e.currentTarget.checked)} />
        <span>{S.steps.trackingOn}</span>
      </label>
      {message && (
        <p class="warning" role="alert">
          {message}
        </p>
      )}
      <NumberField
        label={S.steps.goalLabel}
        value={settings.stepGoal}
        onChange={(stepGoal) => stepGoal > 0 && void updateSettings({ stepGoal })}
        step={500}
        min={500}
        max={100_000}
      />
    </section>
  );
}

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
      <BackupSection />

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
        <span id="palette-label">{S.settings.palette}</span>
        <div class="segmented" role="group" aria-labelledby="palette-label">
          {PALETTES.map((p) => (
            <button key={p.id} type="button" aria-pressed={settings.palette === p.id} onClick={() => updateSettings({ palette: p.id })}>
              <span class="type-dot" style={{ background: p.swatch }} /> {S.settings.palettes[p.id]}
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

      <ProfileSettings />

      <StepsSettings />

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
