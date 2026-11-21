import { useState } from 'preact/hooks';
import { EXERCISE_CATEGORIES } from '../../domain/types';
import type { Exercise, ExerciseCategory } from '../../domain/types';
import { TextField } from '../components/fields';
import { Sheet } from '../components/Sheet';
import { S } from '../strings';

/** Filtre « Mes exercices » : ceux ajoutés sans classement. */
type Filter = ExerciseCategory | 'mine' | null;

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Parcourir le catalogue par catégorie (poids libre, machine, poids du corps, mobilité) et choisir un exercice. */
export function ExercisePickerSheet({ known, onPick, onClose }: { known: readonly Exercise[]; onPick: (e: Exercise) => void; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>(null);
  const [query, setQuery] = useState('');
  const q = fold(query.trim());
  const found = [...known]
    .filter((e) => (filter === null ? true : filter === 'mine' ? e.category === undefined : e.category === filter))
    .filter((e) => !q || fold(e.name).includes(q) || e.aliases.some((a) => fold(a).includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const groups: { key: Filter; label: string }[] = [
    ...EXERCISE_CATEGORIES.map((c) => ({ key: c, label: S.exerciseCategories[c] })),
    { key: 'mine', label: S.exerciseCategories.mine },
  ];

  return (
    <Sheet title={S.edit.catalogueTitle} onClose={onClose}>
      <div class="stack">
        <TextField label={S.edit.catalogueSearch} value={query} onChange={setQuery} />
        <div class="food-filter" role="group" aria-label={S.edit.catalogueFilter}>
          <button type="button" class="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            {S.exerciseCategories.all}
          </button>
          {groups.map((g) => (
            <button key={g.key} type="button" class="chip" aria-pressed={filter === g.key} onClick={() => setFilter(filter === g.key ? null : g.key)}>
              {g.label}
            </button>
          ))}
        </div>
        {groups
          .filter((g) => filter === null || filter === g.key)
          .map((g) => {
            const list = found.filter((e) => (g.key === 'mine' ? e.category === undefined : e.category === g.key));
            if (list.length === 0) return null;
            return (
              <section key={g.key} class="stack tight" aria-label={g.label}>
                <h3 class="food-category">{g.label}</h3>
                <div class="choice-list">
                  {list.map((e) => (
                    <button key={e.id} type="button" class="choice food-choice" onClick={() => onPick(e)}>
                      <span>{e.name}</span>
                      {e.aliases.length > 0 && <span class="muted">{e.aliases.slice(0, 2).join(' · ')}</span>}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        {found.length === 0 && <p class="muted">{S.edit.catalogueEmpty}</p>}
      </div>
    </Sheet>
  );
}
