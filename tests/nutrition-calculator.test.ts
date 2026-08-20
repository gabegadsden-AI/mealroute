import { describe, it, expect } from "vitest";
import { calculateVerifiedIngredients } from "../api/analyze-food/nutrition-calculator";

describe("calculateVerifiedIngredients", () => {
  it("calculates calories for 200g brown rice (cooked)", async () => {
    // 123 kcal/100g → 200g = 246 kcal
    const result = await calculateVerifiedIngredients([
      { name: "brown rice cooked", amountGrams: 200 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].calories).toBe(246);
    expect(result[0].protein).toBe(5.5); // 2.74 * 2
    expect(result[0].carbs).toBe(51.2); // 25.58 * 2, rounded
    expect(result[0].fat).toBe(1.9); // 0.97 * 2, rounded
    expect(result[0].fdcId).toBe(169704);
  });

  it("calculates calories for 150g chicken breast", async () => {
    // 165 kcal/100g → 150g = 247.5 → rounded 247.5
    const result = await calculateVerifiedIngredients([
      { name: "chicken breast", amountGrams: 150 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].calories).toBe(247.5);
    expect(result[0].protein).toBe(46.5); // 31.02 * 1.5
  });

  it("handles multiple ingredients", async () => {
    const result = await calculateVerifiedIngredients([
      { name: "banana", amountGrams: 100 },
      { name: "lentils cooked", amountGrams: 100 },
    ]);
    expect(result).toHaveLength(2);
    // Banana: 89 kcal, Lentils: 116 kcal
    expect(result[0].calories).toBe(89);
    expect(result[1].calories).toBe(116);
  });

  it("uses fdcId for locked ingredient lookup", async () => {
    const result = await calculateVerifiedIngredients([
      { name: "custom name", amountGrams: 50, fdcId: 169704 }, // brown rice
    ]);
    expect(result[0].calories).toBe(61.5); // 123 * 0.5
    expect(result[0].nutritionSource).toContain("USDA");
  });

  it("throws when no USDA key and no local match", async () => {
    await expect(
      calculateVerifiedIngredients([{ name: "alien fruit", amountGrams: 100 }], undefined)
    ).rejects.toThrow();
  });

  it("handles zero grams gracefully (0 calories)", async () => {
    const result = await calculateVerifiedIngredients([
      { name: "banana", amountGrams: 0 },
    ]);
    expect(result[0].calories).toBe(0);
  });
});
