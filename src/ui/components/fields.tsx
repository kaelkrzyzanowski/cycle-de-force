import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import { mondayOf } from '../../domain/dates';
import type { IsoDate } from '../../domain/types';

/** Date native (clavier / calendrier du téléphone). `monday` ramène la date au lundi de sa semaine. */
export function DateField({
  label,
  value,
  onChange,
  monday = false,
  hint,
}: {
  label: string;
  value: IsoDate;
  onChange: (date: IsoDate) => void;
  monday?: boolean;
  hint?: ComponentChildren;
}) {
  const id = useId();
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <input
        id={id}
        type="date"
        class="text-input num"
        value={value}
        required
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v) onChange(monday ? mondayOf(v) : v);
        }}
      />
      {hint && <span class="muted">{hint}</span>}
    </div>
  );
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <input id={id} class="text-input" value={value} onInput={(e) => onChange(e.currentTarget.value)} />
    </div>
  );
}

/** Groupe de choix exclusifs sous forme de gros boutons radio. */
export function RadioList<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; children?: ComponentChildren }[];
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset class="radio-list">
      <legend>{label}</legend>
      {options.map((o) => (
        <div key={o.value} class="radio-option">
          <label>
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
          {value === o.value && o.children}
        </div>
      ))}
    </fieldset>
  );
}
