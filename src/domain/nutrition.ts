import { addDays, mondayOf } from './dates';
import type { IsoDate } from './types';

export type FoodCategory = 'legumes' | 'proteines' | 'feculents';
export const FOOD_CATEGORIES: readonly FoodCategory[] = ['legumes', 'proteines', 'feculents'];

/** Aliment de la table : kcal pour 100 g, cru (ou tel quel) et cuit quand la cuisson change la valeur. */
export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  cru: number;
  cuit?: number;
}

/** Aliment ajouté par l'utilisateur, enregistré en base. */
export type CustomFood = Food & { custom: true };

/** Tables nutritionnelles usuelles, valeurs indicatives (kcal / 100 g). */
export const BASE_FOODS: readonly Food[] = [
  { id: 'brocoli', name: 'Brocoli', category: 'legumes', cru: 34, cuit: 28 },
  { id: 'carotte', name: 'Carotte', category: 'legumes', cru: 41, cuit: 35 },
  { id: 'courgette', name: 'Courgette', category: 'legumes', cru: 17, cuit: 15 },
  { id: 'haricots_verts', name: 'Haricots verts', category: 'legumes', cru: 31, cuit: 26 },
  { id: 'epinards', name: 'Épinards', category: 'legumes', cru: 23 },
  { id: 'tomate', name: 'Tomate', category: 'legumes', cru: 18 },
  { id: 'poivron', name: 'Poivron', category: 'legumes', cru: 31, cuit: 26 },
  { id: 'champignons', name: 'Champignons de Paris', category: 'legumes', cru: 22, cuit: 18 },
  { id: 'aubergine', name: 'Aubergine', category: 'legumes', cru: 25, cuit: 22 },
  { id: 'chou_fleur', name: 'Chou-fleur', category: 'legumes', cru: 25, cuit: 23 },
  { id: 'salade', name: 'Salade verte', category: 'legumes', cru: 15 },
  { id: 'concombre', name: 'Concombre', category: 'legumes', cru: 12 },
  { id: 'petits_pois', name: 'Petits pois', category: 'legumes', cru: 81, cuit: 68 },
  { id: 'oignon', name: 'Oignon', category: 'legumes', cru: 40, cuit: 35 },

  { id: 'poulet_blanc', name: 'Poulet (blanc / filet)', category: 'proteines', cru: 120, cuit: 165 },
  { id: 'poulet_cuisse', name: 'Poulet (cuisse, peau)', category: 'proteines', cru: 195, cuit: 250 },
  { id: 'boeuf_hache5', name: 'Bœuf haché 5 % MG', category: 'proteines', cru: 130, cuit: 172 },
  { id: 'boeuf_hache15', name: 'Bœuf haché 15 % MG', category: 'proteines', cru: 215, cuit: 254 },
  { id: 'boeuf_maigre', name: 'Bœuf (steak maigre)', category: 'proteines', cru: 120, cuit: 172 },
  { id: 'porc_filet', name: 'Porc (filet mignon)', category: 'proteines', cru: 143, cuit: 173 },
  { id: 'dinde_escalope', name: 'Dinde (escalope)', category: 'proteines', cru: 104, cuit: 150 },
  { id: 'saumon', name: 'Saumon', category: 'proteines', cru: 180, cuit: 200 },
  { id: 'cabillaud', name: 'Cabillaud / colin', category: 'proteines', cru: 82, cuit: 95 },
  { id: 'thon_frais', name: 'Thon (frais)', category: 'proteines', cru: 130, cuit: 144 },
  { id: 'thon_boite', name: 'Thon en boîte (au naturel, égoutté)', category: 'proteines', cru: 116 },
  { id: 'crevettes', name: 'Crevettes', category: 'proteines', cru: 71, cuit: 99 },
  { id: 'oeuf', name: 'Œuf', category: 'proteines', cru: 143, cuit: 155 },
  { id: 'jambon_blanc', name: 'Jambon blanc', category: 'proteines', cru: 100 },
  { id: 'tofu', name: 'Tofu nature', category: 'proteines', cru: 76 },
  { id: 'fromage_blanc', name: 'Fromage blanc 0 %', category: 'proteines', cru: 45 },
  { id: 'yaourt_nature', name: 'Yaourt nature', category: 'proteines', cru: 60 },
  { id: 'skyr', name: 'Skyr nature', category: 'proteines', cru: 54 },

  { id: 'riz_blanc', name: 'Riz blanc', category: 'feculents', cru: 349, cuit: 130 },
  { id: 'riz_complet', name: 'Riz complet', category: 'feculents', cru: 350, cuit: 123 },
  { id: 'pates_blanches', name: 'Pâtes blanches', category: 'feculents', cru: 350, cuit: 158 },
  { id: 'pates_completes', name: 'Pâtes complètes', category: 'feculents', cru: 348, cuit: 150 },
  { id: 'quinoa', name: 'Quinoa', category: 'feculents', cru: 368, cuit: 120 },
  { id: 'semoule', name: 'Semoule / couscous', category: 'feculents', cru: 376, cuit: 112 },
  { id: 'pomme_terre', name: 'Pomme de terre', category: 'feculents', cru: 77, cuit: 86 },
  { id: 'patate_douce', name: 'Patate douce', category: 'feculents', cru: 86, cuit: 90 },
  { id: 'pain_blanc', name: 'Pain blanc', category: 'feculents', cru: 265 },
  { id: 'pain_complet', name: 'Pain complet', category: 'feculents', cru: 247 },
  { id: 'lentilles', name: 'Lentilles (sèches / cuites)', category: 'feculents', cru: 336, cuit: 116 },
  { id: 'pois_chiches', name: 'Pois chiches (secs / cuits)', category: 'feculents', cru: 364, cuit: 164 },
  { id: 'haricots_rouges', name: 'Haricots rouges (secs / cuits)', category: 'feculents', cru: 333, cuit: 127 },
  { id: 'flocons_avoine', name: 'Flocons d’avoine', category: 'feculents', cru: 375 },
];

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

/** Recherche sans tenir compte des accents ni de la casse. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export function searchFoods(foods: readonly Food[], query: string): Food[] {
  const q = fold(query.trim());
  return q ? foods.filter((f) => fold(f.name).includes(q)) : [...foods];
}
