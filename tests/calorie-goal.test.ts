import { describe, it, expect } from "vitest";
import { suggestedCalories, activityFactors, cmToImperial } from "../lib/calorie-goal";

describe("suggestedCalories", () => {
  it("calculates BMR for a 30yo male, 80kg, 180cm, sedentary, maintain", () => {
    // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 1780
    // Maintenance = 1780 * 1.2 = 2136
    const result = suggestedCalories(80, 180, 30, "male", "sedentary", "maintain_weight");
    expect(result).toBe(2140); // rounded to nearest 10
  });

  it("lose_weight floors at BMR (protected estimate)", () => {
    // Maintain: 2136 → 2140
    // Lose: max(BMR=1780, 2136-500=1636, 1200) = 1780
    // Diff is ~360 because BMR protects against going too low
    const maintain = suggestedCalories(80, 180, 30, "male", "sedentary", "maintain_weight");
    const lose = suggestedCalories(80, 180, 30, "male", "sedentary", "lose_weight");
    expect(lose).toBe(1780); // BMR floor
    expect(maintain - lose).toBe(360); // 2140 - 1780
  });

  it("applies +250 for build_muscle goal", () => {
    // Moderate: BMR=1780, maintenance=1780*1.55=2759
    // Build: max(1780, 2759+250=3009, 1200) = 3009 → 3010
    const maintain = suggestedCalories(80, 180, 30, "male", "moderate", "maintain_weight");
    const build = suggestedCalories(80, 180, 30, "male", "moderate", "build_muscle");
    expect(build - maintain).toBe(250);
  });

  it("calculates female BMR with -161 correction", () => {
    // BMR = 10*70 + 6.25*165 - 5*28 - 161 = 1430.25
    // Maintenance (light) = 1430.25 * 1.375 = 1966.6
    const result = suggestedCalories(70, 165, 28, "female", "light", "maintain_weight");
    expect(result).toBe(1970);
  });

  it("never drops below 1200 calories", () => {
    const result = suggestedCalories(40, 150, 60, "female", "sedentary", "lose_weight");
    expect(result).toBeGreaterThanOrEqual(1200);
  });

  it("never exceeds 6000 calories", () => {
    const result = suggestedCalories(200, 200, 25, "male", "extra", "build_muscle");
    expect(result).toBeLessThanOrEqual(6000);
  });
});

describe("activityFactors", () => {
  it("has all 5 activity levels", () => {
    expect(Object.keys(activityFactors)).toHaveLength(5);
    expect(activityFactors.sedentary).toBe(1.2);
    expect(activityFactors.extra).toBe(1.9);
  });
});

describe("cmToImperial", () => {
  it("converts 180cm to 5'11\"", () => {
    const result = cmToImperial(180);
    expect(result.feet).toBe("5");
    expect(result.inches).toBe("11");
  });

  it("returns empty strings for null", () => {
    const result = cmToImperial(null);
    expect(result.feet).toBe("");
    expect(result.inches).toBe("");
  });
});
