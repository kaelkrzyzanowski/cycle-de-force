import { useState } from 'preact/hooks';
import { activityKcal, isCompleteProfile } from '../../domain/calories';
import { addDays, todayIso } from '../../domain/dates';
import { newId } from '../../domain/ids';
import {
  allFoods,
  dayKcal,
  emptyFoodDay,
  FOOD_CATEGORIES,
  goalStatus,
  hasFood,
  journalStats,
  mealKcal,
  MEALS,
  overviewWeeks,
  recentFoods,
} from '../../domain/nutrition';
import type { CustomFood, FoodCategory, FoodDay, FoodEntry, GoalStatus, MealKey } from '../../domain/nutrition';
import type { Activity, IsoDate } from '../../domain/types';
import { StatTile } from '../charts/parts';
import { TextField } from '../components/fields';
import { NumberField } from '../components/NumberField';
import { useApp, useData } from '../context';
import { formatDayLong, formatDayMedium, formatKcal, formatKg } from '../format';
import { FoodEntrySheet } from '../sheets/FoodEntrySheet';
import { S } from '../strings';

const ALL = ['0000-01-01', '9999-12-31'] as const;
const OVERVIEW_WEEKS = 16;
const RING_R = 70;
const RING_C = 2 * Math.PI * RING_R;
const int = new Intl.NumberFormat('fr-FR');

const STATUS_COLOR: Record<GoalStatus, string> = {
  none: 'var(--surface-2)',
  good: 'var(--st-validated)',
  warn: 'var(--st-not-done)',
  over: 'var(--st-failed)',
};

interface Data {
  days: FoodDay[];
  customFoods: CustomFood[];
  activities: Activity[];
}

export function JournalScreen() {
  const today = todayIso();
  const [date, setDate] = useState<IsoDate>(today);
  const data = useData<Data>(
    async (repo) => ({
      days: await repo.listFoodDays(...ALL),
      customFoods: await repo.listCustomFoods(),
      activities: await repo.listActivitiesBetween(date, date),
    }),
    [date],
  );
  if (!data) return <p class="muted">{S.loading}</p>;
  return <Journal {...data} date={date} today={today} setDate={setDate} />;
}

function Journal({ days, customFoods, activities, date, today, setDate }: Data & { date: IsoDate; today: IsoDate; setDate: (d: IsoDate) => void }) {
  const app = useApp();
  const { kcalGoal: goal, profile } = app.settings;
  const [sheet, setSheet] = useState<{ meal: MealKey; entry?: FoodEntry } | null>(null);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const day = byDate.get(date) ?? emptyFoodDay(date);
  const foods = allFoods(customFoods);
  const recent = recentFoods(days, foods);

  const total = Math.round(dayKcal(day));
  const status = goalStatus(total, goal);
  const ratio = goal > 0 ? Math.min(1, total / goal) : 0;
  const burned = isCompleteProfile(profile) ? activities.reduce((t, a) => t + (activityKcal(profile, a) ?? 0), 0) : 0;
  const stats = journalStats(days, goal);

  const saveDay = async (next: FoodDay) => {
    try {
      await app.repo.saveFoodDay(next);
      app.refresh();
    } catch (err) {
      console.error(err);
      app.toast(S.saveError);
    }
  };
  const putEntry = (meal: MealKey, entry: FoodEntry) => {
    const items = day.meals[meal];
    const exists = items.some((i) => i.id === entry.id);
    void saveDay({ ...day, meals: { ...day.meals, [meal]: exists ? items.map((i) => (i.id === entry.id ? entry : i)) : [...items, entry] } });
    setSheet(null);
  };
  const removeEntry = (meal: MealKey, id: string) => {
    void saveDay({ ...day, meals: { ...day.meals, [meal]: day.meals[meal].filter((i) => i.id !== id) } });
    setSheet(null);
  };

  return (
    <div class="stack journal">
      <div class="cal-nav">
        <button type="button" class="icon-btn" aria-label={S.journal.previousDay} onClick={() => setDate(addDays(date, -1))}>
          ‹
        </button>
        <h2 aria-live="polite">{formatDayLong(date)}</h2>
        <button type="button" class="icon-btn" aria-label={S.journal.nextDay} onClick={() => setDate(addDays(date, 1))}>
          ›
        </button>
        <button type="button" class="btn small" onClick={() => setDate(today)} disabled={date === today}>
          {S.calendar.today}
        </button>
      </div>

      <section class="card journal-summary" aria-label={S.journal.dayTotal}>
        <svg class="kcal-ring" viewBox="0 0 168 168" aria-hidden="true">
          <circle cx="84" cy="84" r={RING_R} fill="none" stroke="var(--surface-2)" stroke-width="12" />
          <circle
            cx="84"
            cy="84"
            r={RING_R}
            fill="none"
            stroke={STATUS_COLOR[status]}
            stroke-width="12"
            stroke-linecap="round"
            stroke-dasharray={`${(ratio * RING_C).toFixed(1)} ${RING_C.toFixed(1)}`}
            transform="rotate(-90 84 84)"
          />
          <text x="84" y="82" text-anchor="middle" class="kcal-ring-total">
            {int.format(total)}
          </text>
          <text x="84" y="104" text-anchor="middle" class="kcal-ring-goal">
            / {int.format(goal)} kcal
          </text>
        </svg>
        <div class="stack tight">
          <p class={`kcal-status is-${status}`}>
            {status === 'none'
              ? S.journal.empty
              : total <= goal
                ? S.journal.remaining(int.format(goal - total))
                : S.journal.over(int.format(total - goal))}
          </p>
          {burned > 0 && <p class="muted num">{S.journal.burned(formatKcal(burned))}</p>}
        </div>
        <div class="journal-goal">
          <NumberField
            label={S.journal.goal}
            value={goal}
            onChange={(kcalGoal) => kcalGoal > 0 && void app.updateSettings({ kcalGoal })}
            step={50}
            min={500}
            max={10_000}
            suffix="kcal"
            buttons={false}
          />
        </div>
      </section>

      {MEALS.map((meal) => {
        const items = day.meals[meal];
        const subtotal = Math.round(mealKcal(items));
        return (
          <section key={meal} class="card stack tight meal-card" aria-label={S.journal.meals[meal]}>
            <div class="meal-head">
              <h3>{S.journal.meals[meal]}</h3>
              <span class={`num${subtotal > 0 ? '' : ' muted'}`}>{formatKcal(subtotal)}</span>
            </div>
            {items.map((item) => (
              <button key={item.id} type="button" class="food-row" onClick={() => setSheet({ meal, entry: item })}>
                <span class="food-row-name">{item.name}</span>
                <span class="muted num">
                  {item.grams !== undefined ? `${formatKg(item.grams)} g` : S.journal.free}
                  {item.state ? ` · ${S.journal.states[item.state].toLowerCase()}` : ''}
                </span>
                <span class="num food-row-kcal">{formatKcal(Math.round(item.kcal))}</span>
              </button>
            ))}
            <button type="button" class="add-food" onClick={() => setSheet({ meal })}>
              + {S.journal.addFood}
            </button>
          </section>
        );
      })}
      <p class="muted hint">{S.journal.hint}</p>

      <CustomFoods foods={customFoods} />

      <div class="tiles">
        <StatTile label={S.journal.statDays} value={String(stats.days)} />
        <StatTile label={S.journal.statAverage} value={stats.average === null ? '—' : formatKcal(stats.average)} />
        <StatTile label={S.journal.statUnder} value={String(stats.underGoal)} />
      </div>

      <Overview byDate={byDate} goal={goal} today={today} selected={date} onSelect={setDate} />

      {sheet && (
        <FoodEntrySheet
          meal={sheet.meal}
          entry={sheet.entry}
          foods={foods}
          recent={recent}
          onSave={(entry) => putEntry(sheet.meal, entry)}
          onDelete={sheet.entry ? () => removeEntry(sheet.meal, sheet.entry!.id) : undefined}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

/** Aliments absents de la table : nom, catégorie, kcal pour 100 g (cru, et cuit si différent). */
function CustomFoods({ foods }: { foods: readonly CustomFood[] }) {
  const app = useApp();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('proteines');
  const [cru, setCru] = useState(0);
  const [hasCuit, setHasCuit] = useState(false);
  const [cuit, setCuit] = useState(0);
  const valid = name.trim() !== '' && cru > 0 && (!hasCuit || cuit > 0);

  const add = async () => {
    if (!valid) return;
    const food: CustomFood = { id: `cf-${newId()}`, name: name.trim(), category, cru, ...(hasCuit ? { cuit } : {}), custom: true };
    await app.repo.saveCustomFood(food);
    app.refresh();
    app.toast(S.journal.customAdded(food.name));
    setName('');
    setCru(0);
    setCuit(0);
    setHasCuit(false);
  };
  const remove = async (food: CustomFood) => {
    await app.repo.deleteCustomFood(food.id);
    app.refresh();
    app.toast(S.journal.customDeleted(food.name));
  };

  return (
    <details class="card custom-foods">
      <summary>{S.journal.customTitle}</summary>
      <div class="stack">
        <p class="muted">{S.journal.customHint}</p>
        <TextField label={S.journal.foodName} value={name} onChange={setName} />
        <label class="field">
          <span>{S.journal.category}</span>
          <select class="text-input" value={category} onChange={(e) => setCategory(e.currentTarget.value as FoodCategory)}>
            {FOOD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {S.journal.categories[c]}
              </option>
            ))}
          </select>
        </label>
        <NumberField label={S.journal.kcalCru} value={cru} onChange={setCru} step={1} max={1000} suffix="kcal" buttons={false} />
        <label class="switch-row">
          <input type="checkbox" checked={hasCuit} onChange={(e) => setHasCuit(e.currentTarget.checked)} />
          <span>{S.journal.hasCuit}</span>
        </label>
        {hasCuit && <NumberField label={S.journal.kcalCuit} value={cuit} onChange={setCuit} step={1} max={1000} suffix="kcal" buttons={false} />}
        <button type="button" class="btn primary" disabled={!valid} onClick={() => void add()}>
          {S.journal.customAdd}
        </button>
        {foods.length > 0 && (
          <ul class="custom-food-list">
            {[...foods]
              .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
              .map((f) => (
                <li key={f.id}>
                  <span class="food-row-name">{f.name}</span>
                  <span class="muted num">{f.cuit === undefined ? S.journal.per100(f.cru) : S.journal.per100Both(f.cru, f.cuit)}</span>
                  <button type="button" class="icon-btn" aria-label={S.journal.customDelete(f.name)} onClick={() => void remove(f)}>
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </details>
  );
}

/** Carte de chaleur des dernières semaines : couleur selon l'objectif, tap pour ouvrir le jour. */
function Overview({
  byDate,
  goal,
  today,
  selected,
  onSelect,
}: {
  byDate: ReadonlyMap<IsoDate, FoodDay>;
  goal: number;
  today: IsoDate;
  selected: IsoDate;
  onSelect: (d: IsoDate) => void;
}) {
  const weeks = overviewWeeks(today, OVERVIEW_WEEKS);
  return (
    <section class="card stack tight">
      <h2 class="card-title">{S.journal.overview}</h2>
      <div class="kcal-heatmap" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.flatMap((week) =>
          week.map((d) => {
            const dayData = byDate.get(d);
            const t = Math.round(dayKcal(dayData));
            const st = hasFood(dayData) ? goalStatus(t, goal) : 'none';
            const future = d > today;
            return (
              <button
                key={d}
                type="button"
                class={`heat-cell is-${st}${d === selected ? ' is-selected' : ''}${d === today ? ' is-today' : ''}`}
                disabled={future}
                aria-label={hasFood(dayData) ? `${formatDayMedium(d)} · ${formatKcal(t)}` : formatDayMedium(d)}
                onClick={() => onSelect(d)}
              />
            );
          }),
        )}
      </div>
      <p class="heat-legend muted">
        <span class="heat-cell is-good" aria-hidden="true" /> {S.journal.legendGood}
        <span class="heat-cell is-warn" aria-hidden="true" /> {S.journal.legendWarn}
        <span class="heat-cell is-over" aria-hidden="true" /> {S.journal.legendOver}
      </p>
    </section>
  );
}
