import { describe, expect, it } from "vitest";
import { rescaleAnalysisToReview, type FoodAnalysis } from "../lib/app-utils";

const baseAnalysis: FoodAnalysis = {
  mealName: "Chicken and rice",
  calories: { low: 400, high: 500, best: 450 },
  protein: 30,
  carbs: 60,
  fat: 10,
  fibre: 2,
  ingredients: [
    { name: "Chicken breast", amountGrams: 120, calories: 198, protein: 37, carbs: 0, fat: 4.3, fibre: 0, calculationSource: "usda" },
    { name: "Rice", amountGrams: 150, calories: 194, protein: 4, carbs: 42, fat: 0.4, fibre: 0.6, calculationSource: "usda" },
  ],
  confidence: "Medium",
  uncertainties: [],
  clarifyingQuestions: [],
  notes: "",
  calculationMethod: "verified_database",
};

// Values as they arrive from the review editor: grams edited (150 -> 200 g rice)
// and per-item nutrition already rescaled by Modal.updateReviewGrams.
const editedReview = {
  ingredients: [
    { name: "Chicken breast", amountGrams: 120, calories: 198, protein: 37, carbs: 0, fat: 4.3, fibre: 0, calculationSource: "usda" as const },
    { name: "Rice", amountGrams: 200, calories: 259, protein: 5.4, carbs: 56, fat: 0.5, fibre: 0.8, calculationSource: "usda" as const },
  ],
};

describe("rescaleAnalysisToReview", () => {
  it("returns null when there is no analysis or no review ingredients", () => {
    expect(rescaleAnalysisToReview(null, editedReview)).toBeNull();
    expect(rescaleAnalysisToReview(baseAnalysis, undefined)).toBeNull();
    expect(rescaleAnalysisToReview(baseAnalysis, { ingredients: [] })).toBeNull();
  });

  it("rebuilds the headline totals from the rescaled review items", () => {
    const result = rescaleAnalysisToReview(baseAnalysis, editedReview);
    expect(result).not.toBeNull();
    // 198 + 259 = 457 kcal — updated, not the stale 450
    expect(result!.calories.best).toBe(457);
    expect(result!.calories.low).toBe(457);
    expect(result!.calories.high).toBe(457);
    expect(result!.protein).toBe(42.4);
    expect(result!.carbs).toBe(56);
    expect(result!.fat).toBe(4.8);
    expect(result!.fibre).toBe(0.8);
  });

  it("keeps the confirmed names and gram amounts on every ingredient", () => {
    const result = rescaleAnalysisToReview(baseAnalysis, editedReview)!;
    expect(result.ingredients.map(item => [item.name, item.amountGrams])).toEqual([
      ["Chicken breast", 120],
      ["Rice", 200],
    ]);
  });

  it("reports ai_estimate when no ingredient has a verified source", () => {
    const aiReview = {
      ingredients: editedReview.ingredients.map(item => ({ ...item, calculationSource: undefined })),
    };
    const result = rescaleAnalysisToReview(baseAnalysis, aiReview)!;
    expect(result.calculationMethod).toBe("ai_estimate");
    expect(result.calories.best).toBe(457);
  });

  it("reports verified_database when every ingredient is USDA-backed", () => {
    const result = rescaleAnalysisToReview(baseAnalysis, editedReview)!;
    expect(result.calculationMethod).toBe("verified_database");
  });

  it("reports nutrition_label when every ingredient uses a package label", () => {
    const labelReview = {
      ingredients: editedReview.ingredients.map(item => ({ ...item, calculationSource: "nutrition_label" as const })),
    };
    const result = rescaleAnalysisToReview(baseAnalysis, labelReview)!;
    expect(result.calculationMethod).toBe("nutrition_label");
  });

  it("reports mixed_sources when only some ingredients are verified", () => {
    const mixedReview = {
      ingredients: [
        { ...editedReview.ingredients[0] },
        { ...editedReview.ingredients[1], calculationSource: undefined },
      ],
    };
    const result = rescaleAnalysisToReview(baseAnalysis, mixedReview)!;
    expect(result.calculationMethod).toBe("mixed_sources");
  });

  it("ignores junk values instead of producing NaN totals", () => {
    const junkReview = {
      ingredients: [
        { name: "Mystery", amountGrams: "" as const, calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
      ],
    };
    const result = rescaleAnalysisToReview(baseAnalysis, junkReview)!;
    expect(result.calories.best).toBe(0);
    expect(Number.isFinite(result.protein)).toBe(true);
  });
});
