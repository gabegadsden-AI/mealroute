import { describe, it, expect } from "vitest";
import {
  calculateRecipeNutrition,
  type RecipeIngredient,
} from "../lib/recipes";
import {
  EMPTY_MICRONUTRIENTS,
} from "../lib/micronutrients";

describe("calculateRecipeNutrition", () => {
  it("calculates per-serving nutrition correctly for a simple recipe", () => {
    const ingredients: RecipeIngredient[] = [
      { name: "Chicken breast", grams: 200, calories: 330, protein: 62, carbs: 0, fat: 7, fibre: 0 },
      { name: "Rice", grams: 150, calories: 195, protein: 4, carbs: 40, fat: 0.5, fibre: 1 },
    ];
    const result = calculateRecipeNutrition(ingredients, 2);
    expect(result.caloriesPerServing).toBe(263); // (330+195)/2
    expect(result.proteinPerServing).toBe(33);   // (62+4)/2
    expect(result.carbsPerServing).toBe(20);     // (0+40)/2
    expect(result.fatPerServing).toBe(3.8);      // (7+0.5)/2
    expect(result.fibrePerServing).toBe(0.5);   // (0+1)/2
  });

  it("handles 1 serving correctly", () => {
    const ingredients: RecipeIngredient[] = [
      { name: "Oats", grams: 100, calories: 389, protein: 17, carbs: 66, fat: 7, fibre: 10 },
    ];
    const result = calculateRecipeNutrition(ingredients, 1);
    expect(result.caloriesPerServing).toBe(389);
    expect(result.proteinPerServing).toBe(17);
    expect(result.carbsPerServing).toBe(66);
  });

  it("handles empty ingredients", () => {
    const result = calculateRecipeNutrition([], 4);
    expect(result.caloriesPerServing).toBe(0);
    expect(result.proteinPerServing).toBe(0);
  });

  it("clamps servings to minimum 1", () => {
    const ingredients: RecipeIngredient[] = [
      { name: "Egg", grams: 100, calories: 155, protein: 13, carbs: 1, fat: 11, fibre: 0 },
    ];
    const result = calculateRecipeNutrition(ingredients, 0);
    expect(result.caloriesPerServing).toBe(155);
  });

  it("clamps servings to maximum 50", () => {
    const ingredients: RecipeIngredient[] = [
      { name: "Flour", grams: 1000, calories: 3600, protein: 100, carbs: 760, fat: 10, fibre: 40 },
    ];
    const result = calculateRecipeNutrition(ingredients, 100);
    expect(result.caloriesPerServing).toBe(72); // 3600/50
  });

  it("accumulates micronutrients correctly", () => {
    const micros = {
      ...EMPTY_MICRONUTRIENTS,
      vitaminC: 50,
      iron: 3,
    };
    const ingredients: RecipeIngredient[] = [
      { name: "Orange", grams: 200, calories: 94, protein: 1.8, carbs: 23.8, fat: 0.2, fibre: 4.6, micros },
    ];
    const result = calculateRecipeNutrition(ingredients, 2);
    expect(result.micros.vitaminC).toBe(25); // 50/2
    expect(result.micros.iron).toBe(1.5);   // 3/2
  });
});
