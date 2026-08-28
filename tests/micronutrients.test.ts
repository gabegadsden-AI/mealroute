import { describe, it, expect } from "vitest";
import {
  extractOFFMicronutrients,
  extractUSDAMicronutrients,
  scaleMicronutrients,
  addMicronutrients,
  hasMicronutrientData,
  EMPTY_MICRONUTRIENTS,
  MICRONUTRIENT_KEYS,
  MICRONUTRIENT_DV,
} from "../lib/micronutrients";

describe("extractOFFMicronutrients", () => {
  it("extracts vitamins and minerals from OFF nutriments", () => {
    const nutriments = {
      "vitamin-a_100g": 50,
      "vitamin-c_100g": 10,
      "vitamin-d_100g": 5,
      "vitamin-e_100g": 3,
      "vitamin-k_100g": 2,
      "thiamin_100g": 0.5,
      "riboflavin_100g": 0.3,
      "niacin_100g": 4,
      "vitamin-b6_100g": 0.2,
      "folate_100g": 100,
      "vitamin-b12_100g": 1.5,
      "calcium_100g": 200,
      "iron_100g": 3,
      "magnesium_100g": 50,
      "potassium_100g": 300,
      "zinc_100g": 2,
      "sodium_100g": 400,
    };
    const result = extractOFFMicronutrients(nutriments);
    expect(result.vitaminA).toBe(50);
    expect(result.vitaminC).toBe(10);
    expect(result.calcium).toBe(200);
    expect(result.iron).toBe(3);
    expect(result.sodium).toBe(400);
  });

  it("returns all zeros for empty nutriments", () => {
    const result = extractOFFMicronutrients({});
    expect(hasMicronutrientData(result)).toBe(false);
  });

  it("handles null/undefined nutriments", () => {
    const result = extractOFFMicronutrients(null as any);
    expect(hasMicronutrientData(result)).toBe(false);
  });
});

describe("extractUSDAMicronutrients", () => {
  it("extracts micronutrients from USDA FDC format (nutrientId + value)", () => {
    const foodNutrients = [
      { nutrientId: 1106, value: 900 }, // vitaminA
      { nutrientId: 1162, value: 90 },  // vitaminC
      { nutrientId: 1087, value: 1300 }, // calcium
      { nutrientId: 1089, value: 18 },  // iron
    ];
    const result = extractUSDAMicronutrients(foodNutrients);
    expect(result.vitaminA).toBe(900);
    expect(result.vitaminC).toBe(90);
    expect(result.calcium).toBe(1300);
    expect(result.iron).toBe(18);
  });

  it("extracts micronutrients from USDA FDC format (nutrient.id + amount)", () => {
    const foodNutrients = [
      { nutrient: { id: 1106 }, amount: 500 }, // vitaminA
      { nutrient: { id: 1092 }, amount: 4700 }, // potassium
    ];
    const result = extractUSDAMicronutrients(foodNutrients);
    expect(result.vitaminA).toBe(500);
    expect(result.potassium).toBe(4700);
  });

  it("ignores unknown nutrient IDs", () => {
    const foodNutrients = [
      { nutrientId: 9999, value: 100 },
      { nutrientId: 1106, value: 50 },
    ];
    const result = extractUSDAMicronutrients(foodNutrients);
    expect(result.vitaminA).toBe(50);
  });

  it("returns zeros for empty array", () => {
    const result = extractUSDAMicronutrients([]);
    expect(hasMicronutrientData(result)).toBe(false);
  });
});

describe("scaleMicronutrients", () => {
  it("scales per-100g values to actual grams consumed", () => {
    const micros = {
      ...EMPTY_MICRONUTRIENTS,
      vitaminC: 90,
      calcium: 200,
    };
    const scaled = scaleMicronutrients(micros, 200);
    // 200g = 2x per-100g
    expect(scaled.vitaminC).toBe(180);
    expect(scaled.calcium).toBe(400);
  });

  it("returns zeros for 0 grams", () => {
    const micros = { ...EMPTY_MICRONUTRIENTS, vitaminC: 90 };
    const scaled = scaleMicronutrients(micros, 0);
    expect(scaled.vitaminC).toBe(0);
  });

  it("clamps to 5000g max", () => {
    const micros = { ...EMPTY_MICRONUTRIENTS, calcium: 100 };
    const scaled = scaleMicronutrients(micros, 5000);
    expect(scaled.calcium).toBe(5000);
  });
});

describe("addMicronutrients", () => {
  it("adds two micronutrient sets together", () => {
    const a = { ...EMPTY_MICRONUTRIENTS, vitaminC: 50, iron: 5 };
    const b = { ...EMPTY_MICRONUTRIENTS, vitaminC: 30, iron: 3 };
    const result = addMicronutrients(a, b);
    expect(result.vitaminC).toBe(80);
    expect(result.iron).toBe(8);
  });

  it("handles undefined inputs gracefully", () => {
    const result = addMicronutrients({ ...EMPTY_MICRONUTRIENTS, calcium: 100 }, { ...EMPTY_MICRONUTRIENTS });
    expect(result.calcium).toBe(100);
  });
});

describe("hasMicronutrientData", () => {
  it("returns true when any value is positive", () => {
    expect(hasMicronutrientData({ ...EMPTY_MICRONUTRIENTS, vitaminC: 1 })).toBe(true);
  });
  it("returns false for all zeros", () => {
    expect(hasMicronutrientData(EMPTY_MICRONUTRIENTS)).toBe(false);
  });
  it("returns false for undefined", () => {
    expect(hasMicronutrientData(undefined)).toBe(false);
  });
});

describe("MICRONUTRIENT constants", () => {
  it("has 17 micronutrient keys", () => {
    expect(MICRONUTRIENT_KEYS).toHaveLength(17);
  });
  it("has daily values for all keys", () => {
    for (const key of MICRONUTRIENT_KEYS) {
      expect(MICRONUTRIENT_DV[key]).toBeGreaterThan(0);
    }
  });
});
