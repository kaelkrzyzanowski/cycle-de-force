import { addDays, mondayOf } from './dates';
import { BASE_FOODS } from './foods';
import type { IsoDate } from './types';

export type FoodCategory =
  | 'restauration'
  | 'legumes'
  | 'fruits'
  | 'proteines'
  | 'laitiers'
  | 'feculents'
  | 'boulangerie'
  | 'gras'
  | 'sucre'
  | 'boissons';
export const FOOD_CATEGORIES: readonly FoodCategory[] = [
  'restauration',
  'legumes',
  'fruits',
  'proteines',
  'laitiers',
  'feculents',
  'boulangerie',
  'gras',
  'sucre',
  'boissons',
];

/** Aliment de la table : kcal pour 100 g, cru (ou tel quel) et cuit quand la cuisson change la valeur. */
export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  cru: number;
  cuit?: number;
  /** Portion type (une pizza, un verre…), proposée par défaut à la saisie. */
  portion?: { label: string; grams: number };
}

/** Aliment ajouté par l'utilisateur, enregistré en base. */
export type CustomFood = Food & { custom: true };

export { BASE_FOODS };

export type MealKey = 'matin' | 'midi' | 'soir' | 'col1' | 'col2';
export const MEALS: readonly MealKey[] = ['matin', 'midi', 'soir', 'col1', 'col2'];

export type FoodState = 'cru' | 'cuit';

/**
 * Aliment consommé. Avec `foodId` : poids et état, kcal calculées à la saisie ;
 * sans : aliment libre, kcal saisies telles quelles. Les kcal sont gardées telles qu'enregistrées
 * (l'historique ne bouge pas si un aliment personnalisé est modifié ou supprimé).
 */
export interface FoodEntry {
  id: string;
  foodId: string | null;
  name: string;
  grams?: number;
  state?: FoodState;
  kcal: number;
}

/** Journal d'un jour : aliments par repas. */
export interface FoodDay {
  date: IsoDate;
  meals: Record<MealKey, FoodEntry[]>;
}

export const DEFAULT_KCAL_GOAL = 2000;

export const emptyFoodDay = (date: IsoDate): FoodDay => ({ date, meals: { matin: [], midi: [], soir: [], col1: [], col2: [] } });

/** kcal pour 100 g selon l'état (la valeur crue sert si l'aliment n'a pas de valeur cuite). */
export const per100 = (food: Food, state: FoodState | undefined): number => (state === 'cuit' && food.cuit !== undefined ? food.cuit : food.cru);

export const portionKcal = (food: Food, grams: number, state: FoodState | undefined): number =>
  Math.round((grams / 100) * per100(food, state) * 10) / 10;

export const mealKcal = (items: readonly FoodEntry[]): number => items.reduce((t, i) => t + i.kcal, 0);
export const dayKcal = (day: FoodDay | undefined): number => (day ? MEALS.reduce((t, m) => t + mealKcal(day.meals[m]), 0) : 0);
export const hasFood = (day: FoodDay | undefined): boolean => !!day && MEALS.some((m) => day.meals[m].length > 0);

/** Sous l'objectif, jusqu'à 15 % au-dessus, ou au-delà. */
export type GoalStatus = 'none' | 'good' | 'warn' | 'over';
export function goalStatus(total: number, goal: number): GoalStatus {
  if (total <= 0) return 'none';
  if (total <= goal) return 'good';
  if (total <= goal * 1.15) return 'warn';
  return 'over';
}

/** Jours renseignés, moyenne par jour renseigné et jours sous l'objectif. */
export function journalStats(days: readonly FoodDay[], goal: number): { days: number; average: number | null; underGoal: number } {
  const filled = days.filter(hasFood).map(dayKcal);
  return {
    days: filled.length,
    average: filled.length ? Math.round(filled.reduce((a, b) => a + b, 0) / filled.length) : null,
    underGoal: filled.filter((t) => t <= goal).length,
  };
}

/** Semaines (lundi → dimanche) de la vue d'ensemble, la dernière contenant `today`. */
export function overviewWeeks(today: IsoDate, weeks: number): IsoDate[][] {
  const start = addDays(mondayOf(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

/** Toute la table, aliments personnalisés compris, triée par nom dans chaque catégorie. */
export function allFoods(custom: readonly CustomFood[]): Food[] {
  return [...BASE_FOODS, ...custom].sort(
    (a, b) => FOOD_CATEGORIES.indexOf(a.category) - FOOD_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name, 'fr'),
  );
}

/** Derniers aliments de la table saisis (du plus récent au plus ancien), sans doublon. */
export function recentFoods(days: readonly FoodDay[], foods: readonly Food[], max = 8): Food[] {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const out: Food[] = [];
  for (const day of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const meal of [...MEALS].reverse()) {
      for (const item of [...day.meals[meal]].reverse()) {
        const food = item.foodId ? byId.get(item.foodId) : undefined;
        if (food && !out.includes(food)) out.push(food);
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

/** Recherche sans tenir compte des accents ni de la casse. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export function searchFoods(foods: readonly Food[], query: string): Food[] {
  const q = fold(query.trim());
  return q ? foods.filter((f) => fold(f.name).includes(q)) : [...foods];
}
