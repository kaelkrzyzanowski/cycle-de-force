import type { ConflictChoice } from '../../domain/cycles';
import type { IsoDate, Session } from '../../domain/types';
import { formatDayMedium } from '../format';
import { S } from '../strings';

const OPTIONS: { value: ConflictChoice; label: string }[] = [
  { value: 'REPLACE', label: S.conflicts.replace },
  { value: 'ADD', label: S.conflicts.add },
  { value: 'SKIP', label: S.conflicts.skip },
];

export type Choices = Partial<Record<IsoDate, ConflictChoice>>;

export function allResolved(dates: readonly IsoDate[], choices: Choices): boolean {
  return dates.every((d) => choices[d] !== undefined);
}

interface Props {
  dates: readonly IsoDate[];
  existing: readonly Session[];
  choices: Choices;
  onChange: (choices: Choices) => void;
}

/** Pour chaque jour déjà occupé : Remplacer / Ajouter à côté / Ignorer ce jour. */
export function ConflictResolver({ dates, existing, choices, onChange }: Props) {
  if (dates.length === 0) return null;
  const setAll = (value: ConflictChoice) => onChange(Object.fromEntries(dates.map((d) => [d, value])));

  return (
    <section class="card stack conflicts" aria-labelledby="conflicts-title">
      <h2 id="conflicts-title" class="card-title">{S.conflicts.title}</h2>
      <p class="muted">{S.conflicts.intro}</p>
      {dates.length > 1 && (
        <div class="field">
          <span>{S.conflicts.all}</span>
          <div class="segmented small" role="group" aria-label={S.conflicts.all}>
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={dates.every((d) => choices[d] === o.value)}
                onClick={() => setAll(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {dates.map((date) => {
        const names = existing.filter((s) => s.date === date).map((s) => s.name);
        const label = formatDayMedium(date);
        return (
          <div key={date} class="field conflict-row">
            <span>
              {label} <span class="muted">· {S.conflicts.existing(names.join(', '))}</span>
            </span>
            <div class="segmented small" role="group" aria-label={label}>
              {OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={choices[date] === o.value}
                  onClick={() => onChange({ ...choices, [date]: o.value })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!allResolved(dates, choices) && <p class="warning">{S.conflicts.unresolved}</p>}
    </section>
  );
}
