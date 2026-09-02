import { describe, it, expect } from "vitest";

// Test the weekly summary formatting and calculations
// The actual buildWeeklySummary requires Supabase, so we test the pure functions

describe("WeeklySummary HTML rendering", () => {
  it("can import the module without errors", async () => {
    const mod = await import("../lib/weekly-summary");
    expect(typeof mod.buildWeeklySummary).toBe("function");
    expect(typeof mod.renderWeeklySummaryHTML).toBe("function");
  });

  it("renderWeeklySummaryHTML produces valid HTML with key data", async () => {
    const { renderWeeklySummaryHTML } = await import("../lib/weekly-summary");
    const summary = {
      weekStart: "2026-09-01",
      weekEnd: "2026-09-07",
      days: [
        { date: "2026-09-01", calories: 1800, protein: 120, carbs: 200, fat: 60, mealsLogged: 3, waterMl: 2000, micros: {} as any },
        { date: "2026-09-02", calories: 2100, protein: 140, carbs: 220, fat: 70, mealsLogged: 4, waterMl: 2500, micros: {} as any },
      ],
      averages: {
        calories: 1950, protein: 130, carbs: 210, fat: 65, mealsLogged: 3.5, waterMl: 2250,
        micros: {} as any,
      },
      totals: {
        calories: 3900, protein: 260, carbs: 420, fat: 130, mealsLogged: 7, waterMl: 4500,
      },
      weightChange: -0.5,
      startWeight: 75,
      endWeight: 74.5,
      daysTracked: 2,
      goalCalories: 2000,
      goalHitDays: 2,
    };

    const html = renderWeeklySummaryHTML(summary, "Gabriel");
    expect(html).toContain("Weekly Summary");
    expect(html).toContain("1950");
    expect(html).toContain("130g");
    expect(html).toContain("2250ml");
    expect(html).toContain("MealRoute");
    expect(html).toContain("75kg");
    expect(html).toContain("-0.5kg");
  });
});
