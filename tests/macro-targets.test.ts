import { describe, it, expect } from "vitest";
import { suggestedMacroTargets, macroCalories, macroPercentages } from "../lib/macro-targets";

describe("suggestedMacroTargets", () => {
  it("calculates macros for 2000 cal lose_weight (30P/45C/25F)", () => {
    const t = suggestedMacroTargets(2000, "lose_weight");
    // Protein: 2000*0.30/4 = 150g
    // Fat: 2000*0.25/9 = 56g (rounded)
    // Carbs: (2000 - 150*4 - 56*9) / 4 = (2000-600-504)/4 = 224g
    expect(t.protein).toBe(150);
    expect(t.fat).toBe(56);
    expect(t.carbs).toBe(224);
  });

  it("calculates macros for 2500 cal build_muscle (25P/50C/25F)", () => {
    const t = suggestedMacroTargets(2500, "build_muscle");
    // Protein: 2500*0.25/4 = 156g (rounded from 156.25)
    // Fat: 2500*0.25/9 = 69g (rounded from 69.44)
    // Carbs: (2500 - 156*4 - 69*9) / 4 = (2500-624-621)/4 = 313.75 → 314
    expect(t.protein).toBe(156);
    expect(t.fat).toBe(69);
  });

  it("clamps to minimum 1200 calories", () => {
    const t = suggestedMacroTargets(500, "lose_weight");
    const cals = macroCalories(t);
    expect(cals).toBeGreaterThanOrEqual(1100); // close to 1200 after macro rounding
  });

  it("clamps to maximum 6000 calories", () => {
    const t = suggestedMacroTargets(10000, "build_muscle");
    const cals = macroCalories(t);
    expect(cals).toBeLessThanOrEqual(6000);
  });

  it("falls back to eat_healthier for undefined goal", () => {
    const t = suggestedMacroTargets(2000, undefined);
    const t2 = suggestedMacroTargets(2000, "eat_healthier");
    expect(t).toEqual(t2);
  });
});

describe("macroCalories", () => {
  it("calculates total calories from macros", () => {
    // 150g protein * 4 + 224g carbs * 4 + 56g fat * 9 = 600+896+504 = 2000
    expect(macroCalories({ protein: 150, carbs: 224, fat: 56 })).toBe(2000);
  });
});

describe("macroPercentages", () => {
  it("returns percentages summing to ~100", () => {
    const pct = macroPercentages({ protein: 150, carbs: 224, fat: 56 });
    const sum = pct.protein + pct.carbs + pct.fat;
    expect(sum).toBeGreaterThanOrEqual(99);
    expect(sum).toBeLessThanOrEqual(101);
  });

  it("returns zeros for zero macros", () => {
    const pct = macroPercentages({ protein: 0, carbs: 0, fat: 0 });
    expect(pct).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});
