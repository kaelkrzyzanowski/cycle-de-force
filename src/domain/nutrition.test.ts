import { describe, expect, it } from 'vitest';
import {
  allFoods,
  BASE_FOODS,
  dayKcal,
  emptyFoodDay,
  goalStatus,
  journalStats,
  overviewWeeks,
  portionKcal,
  searchFoods,
} from './nutrition';
import type { CustomFood, FoodDay } from './nutrition';

const food = (id: string) => BASE_FOODS.find((f) => f.id === id)!;

function day(date: string, kcals: number[]): FoodDay {
  const d = emptyFoodDay(date);
  d.meals.midi = kcals.map((kcal, i) => ({ id: `${date}-${i}`, foodId: null, name: 'Libre', kcal }));
  return d;
}

describe('journal calorique', () => {
  it('portion : kcal pour 100 g selon cru ou cuit', () => {
    expect(portionKcal(food('riz_blanc'), 150, 'cuit')).toBe(195);
    expect(portionKcal(food('riz_blanc'), 80, 'cru')).toBe(279.2);
    // Pas de valeur cuite : la valeur crue sert.
    expect(portionKcal(food('tomate'), 200, 'cuit')).toBe(36);
  });

  it('total du jour et statut par rapport à l’objectif', () => {
    expect(dayKcal(day('2026-11-07', [500, 700]))).toBe(1200);
    expect(dayKcal(undefined)).toBe(0);
    expect(goalStatus(0, 2000)).toBe('none');
    expect(goalStatus(2000, 2000)).toBe('good');
    expect(goalStatus(2300, 2000)).toBe('warn');
    expect(goalStatus(2301, 2000)).toBe('over');
  });

  it('stats : jours renseignés, moyenne, jours sous l’objectif', () => {
    const days = [day('2026-11-05', [1800]), day('2026-11-06', [2400]), emptyFoodDay('2026-11-07')];
    expect(journalStats(days, 2000)).toEqual({ days: 2, average: 2100, underGoal: 1 });
    expect(journalStats([], 2000)).toEqual({ days: 0, average: null, underGoal: 0 });
  });

  it('vue d’ensemble : semaines du lundi au dimanche jusqu’à aujourd’hui', () => {
    const weeks = overviewWeeks('2026-11-07', 3);
    expect(weeks).toHaveLength(3);
    expect(weeks[0]![0]).toBe('2026-10-19');
    expect(weeks[2]![5]).toBe('2026-11-07');
  });

  it('recherche sans accents, aliments personnalisés compris', () => {
    const mine: CustomFood = { id: 'cf1', name: 'Galette de sarrasin', category: 'feculents', cru: 200, custom: true };
    const foods = allFoods([mine]);
    expect(foods).toHaveLength(BASE_FOODS.length + 1);
    expect(searchFoods(foods, 'epin').map((f) => f.name)).toEqual(['Épinards']);
    expect(searchFoods(foods, 'GALETTE').map((f) => f.id)).toEqual(['cf1']);
  });
});
