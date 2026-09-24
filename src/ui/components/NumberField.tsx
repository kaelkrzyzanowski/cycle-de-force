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
}

/** Nombre avec gros boutons − / + et clavier numérique. */
export function NumberField({ label, value, onChange, step = 1, min = 0, max = 9999, suffix }: Props) {
  const [text, setText] = useState(formatKg(value));
  useEffect(() => setText(formatKg(value)), [value]);

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
        <button type="button" class="step-btn" aria-label={`${label} −${formatKg(step)}`} onClick={() => onChange(clamp(value - step))}>
          −
        </button>
        <input
          class="num"
          inputMode="decimal"
          aria-label={label}
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
        />
        {suffix && <span class="muted">{suffix}</span>}
        <button type="button" class="step-btn" aria-label={`${label} +${formatKg(step)}`} onClick={() => onChange(clamp(value + step))}>
          +
        </button>
      </div>
    </div>
  );
}
