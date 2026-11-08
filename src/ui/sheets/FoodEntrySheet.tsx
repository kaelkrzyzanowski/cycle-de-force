import { useState } from 'preact/hooks';
import { newId } from '../../domain/ids';
import { FOOD_CATEGORIES, per100, portionKcal, searchFoods } from '../../domain/nutrition';
import type { Food, FoodCategory, FoodEntry, FoodState, MealKey } from '../../domain/nutrition';
import { TextField } from '../components/fields';
import { NumberField } from '../components/NumberField';
import { Sheet } from '../components/Sheet';
import { formatKcal } from '../format';
import { S } from '../strings';

type Choice = { kind: 'food'; food: Food } | { kind: 'free' } | null;

/** Ajouter ou modifier un aliment d'un repas : choix dans la table (ou aliment libre), puis portion. */
export function FoodEntrySheet({
  meal,
  entry,
  foods,
  recent,
  onSave,
  onDelete,
  onClose,
}: {
  meal: MealKey;
  entry?: FoodEntry;
  foods: readonly Food[];
  /** Derniers aliments saisis, proposés en tête de liste. */
  recent: readonly Food[];
  onSave: (entry: FoodEntry) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const initial: Choice = !entry
    ? null
    : entry.foodId === null
      ? { kind: 'free' }
      : (() => {
          const food = foods.find((f) => f.id === entry.foodId);
          // Aliment personnalisé supprimé depuis : on ne peut plus recalculer, il devient libre.
          return food ? { kind: 'food', food } : { kind: 'free' };
        })();
  const [choice, setChoice] = useState<Choice>(initial);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [grams, setGrams] = useState(entry?.grams ?? 100);
  const [state, setState] = useState<FoodState>(entry?.state ?? 'cru');
  const [name, setName] = useState(entry?.name ?? '');
  const [kcal, setKcal] = useState(entry?.kcal ?? 0);

  const title = `${entry ? S.journal.editFood : S.journal.addFood} · ${S.journal.meals[meal]}`;

  const pick = (f: Food) => {
    setChoice({ kind: 'food', food: f });
    if (f.cuit === undefined) setState('cru');
    setGrams(f.portion?.grams ?? 100);
  };
  const foodButton = (f: Food) => (
    <button key={f.id} type="button" class="choice food-choice" onClick={() => pick(f)}>
      <span>
        {'custom' in f ? '★ ' : ''}
        {f.name}
      </span>
      <span class="muted num">
        {f.cuit === undefined ? S.journal.per100(f.cru) : S.journal.per100Both(f.cru, f.cuit)}
        {f.portion && <span class="food-portion">{S.journal.portion(f.portion.label, f.portion.grams)}</span>}
      </span>
    </button>
  );

  if (!choice) {
    const found = searchFoods(foods, query).filter((f) => category === null || f.category === category);
    const showRecent = query.trim() === '' && category === null && recent.length > 0;
    return (
      <Sheet title={title} onClose={onClose}>
        <div class="stack">
          <TextField label={S.journal.search} value={query} onChange={setQuery} />
          <div class="food-filter" role="group" aria-label={S.journal.filter}>
            <button type="button" class="chip" aria-pressed={category === null} onClick={() => setCategory(null)}>
              {S.journal.allCategories}
            </button>
            {FOOD_CATEGORIES.map((c) => (
              <button key={c} type="button" class="chip" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>
                {S.journal.categories[c]}
              </button>
            ))}
          </div>
          <button type="button" class="choice" onClick={() => setChoice({ kind: 'free' })}>
            {S.journal.freeFood}
          </button>
          {showRecent && (
            <section class="stack tight" aria-label={S.journal.recent}>
              <h3 class="food-category">{S.journal.recent}</h3>
              <div class="choice-list">{recent.map(foodButton)}</div>
            </section>
          )}
          {FOOD_CATEGORIES.map((cat) => {
            const list = found.filter((f) => f.category === cat);
            if (list.length === 0) return null;
            return (
              <section key={cat} class="stack tight" aria-label={S.journal.categories[cat]}>
                <h3 class="food-category">{S.journal.categories[cat]}</h3>
                <div class="choice-list">{list.map(foodButton)}</div>
              </section>
            );
          })}
          {found.length === 0 && <p class="muted">{S.journal.noResult}</p>}
        </div>
      </Sheet>
    );
  }

  const computed = choice.kind === 'food' ? portionKcal(choice.food, grams, state) : kcal;
  const valid = choice.kind === 'food' ? grams > 0 : name.trim() !== '' && kcal > 0;
  const save = () => {
    if (!valid) return;
    const id = entry?.id ?? newId();
    if (choice.kind === 'food') {
      const f = choice.food;
      onSave({ id, foodId: f.id, name: f.name, grams, ...(f.cuit !== undefined ? { state } : {}), kcal: computed });
    } else {
      onSave({ id, foodId: null, name: name.trim(), kcal });
    }
  };

  return (
    <Sheet title={title} onClose={onClose}>
      <form
        class="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {choice.kind === 'food' ? (
          <>
            <div class="food-picked">
              <strong>{choice.food.name}</strong>
              <button type="button" class="btn small" onClick={() => setChoice(null)}>
                {S.journal.change}
              </button>
            </div>
            {choice.food.cuit !== undefined && (
              <div class="segmented" role="group" aria-label={S.journal.state}>
                {(['cru', 'cuit'] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={state === s} onClick={() => setState(s)}>
                    {S.journal.states[s]} · {S.journal.per100(per100(choice.food, s))}
                  </button>
                ))}
              </div>
            )}
            {choice.food.portion && (
              <div class="chip-row portion-row">
                {[0.5, 1, 2].map((n) => {
                  const g = Math.round(choice.food.portion!.grams * n);
                  return (
                    <button key={n} type="button" class="chip" aria-pressed={grams === g} onClick={() => setGrams(g)}>
                      {n === 1 ? S.journal.portionPick(choice.food.portion!.label, g) : `${n === 0.5 ? '½' : '×2'} · ${g} g`}
                    </button>
                  );
                })}
              </div>
            )}
            <NumberField label={S.journal.grams} value={grams} onChange={setGrams} step={10} min={0} max={5000} suffix="g" />
          </>
        ) : (
          <>
            <TextField label={S.journal.foodName} value={name} onChange={setName} />
            <NumberField label={S.journal.kcal} value={kcal} onChange={setKcal} step={10} min={0} max={10_000} suffix="kcal" buttons={false} />
          </>
        )}
        <p class="food-total num" aria-live="polite">
          {formatKcal(Math.round(computed))}
        </p>
        <div class="button-row">
          {onDelete && (
            <button type="button" class="btn danger" onClick={onDelete}>
              {S.journal.delete}
            </button>
          )}
          <button type="submit" class="btn primary" disabled={!valid}>
            {S.journal.save}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
