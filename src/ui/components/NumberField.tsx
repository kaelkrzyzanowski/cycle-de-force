import { useEffect, useState } from 'preact/hooks';
import { formatKg, parseDecimal } from '../format';

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  /** false : saisie au clavier uniquement, sans boutons − / +. */
  buttons?: boolean;
}

/** Nombre avec gros boutons − / + (ou saisie seule) et clavier numérique. */
export function NumberField({ label, value, onChange, step = 1, min = 0, max = 9999, suffix, buttons = true }: Props) {
  const [text, setText] = useState(formatKg(value));
  useEffect(() => {
    // Ne pas réécrire le champ pendant la frappe si la valeur est la même (« 16, » → 16).
    setText((current) => (parseDecimal(current) === value ? current : formatKg(value)));
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  const commit = (raw: string) => {
    const n = parseDecimal(raw);
    if (n === null) setText(formatKg(value));
    else onChange(clamp(n));
  };

  return (
    <div class="number-field">
      <span class="number-label">{label}</span>
      <div class="number-controls">
        {buttons && (
          <button type="button" class="step-btn" aria-label={`${label} −${formatKg(step)}`} onClick={() => onChange(clamp(value - step))}>
            −
          </button>
        )}
        <input
          class={`num${buttons ? '' : ' wide'}`}
          inputMode="decimal"
          aria-label={label}
          value={text}
          onInput={(e) => {
            const raw = e.currentTarget.value;
            setText(raw);
            // Sans boutons, la valeur suit la frappe : pas besoin de quitter le champ avant de valider.
            const n = parseDecimal(raw);
            if (!buttons && n !== null) onChange(clamp(n));
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
        />
        {suffix && <span class="muted">{suffix}</span>}
        {buttons && (
          <button type="button" class="step-btn" aria-label={`${label} +${formatKg(step)}`} onClick={() => onChange(clamp(value + step))}>
            +
          </button>
        )}
      </div>
    </div>
  );
}
