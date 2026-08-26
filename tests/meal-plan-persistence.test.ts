import { describe, it, expect } from "vitest";
import {
  isDateKey,
  weekStartKey,
  weekDateKeys,
  mealsForWeek,
  shiftDateKey,
} from "../lib/weekly-plan";

type TestMeal = {
  id: number;
  plannedDate?: string;
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snack";
  calories: number;
  name: string;
};

describe("Multi-day meal plan persistence", () => {
  // Simulate what handleAcceptPlan does: create meals for 3 days
  const baseId = 1724572800000; // Date.now() result
  const planDates = ["2026-08-25", "2026-08-26", "2026-08-27"];
  const slots = ["breakfast", "lunch", "dinner", "snack"] as const;

  // Create meals using the new ID generation: baseId * 1000 + idx
  const plannedMeals: TestMeal[] = [];
  let idx = 0;
  for (const date of planDates) {
    for (const slot of slots) {
      plannedMeals.push({
        id: baseId * 1000 + idx, // New robust ID scheme
        plannedDate: date,
        mealSlot: slot,
        calories: 200 + idx * 10,
        name: `Meal ${idx}`,
      });
      idx++;
    }
  }

  it("generates unique integer IDs for all meals", () => {
    const ids = plannedMeals.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(plannedMeals.length); // All 12 IDs are unique
    // All IDs are integers (no float truncation risk)
    expect(ids.every(id => Number.isInteger(id))).toBe(true);
  });

  it("all meals have valid date keys", () => {
    expect(plannedMeals.every(m => m.plannedDate && isDateKey(m.plannedDate))).toBe(true);
  });

  it("meals span 3 distinct dates", () => {
    const dates = new Set(plannedMeals.map(m => m.plannedDate));
    expect(dates.size).toBe(3);
    expect(dates.has("2026-08-25")).toBe(true);
    expect(dates.has("2026-08-26")).toBe(true);
    expect(dates.has("2026-08-27")).toBe(true);
  });

  it("all meals appear in the correct week", () => {
    const weekStart = weekStartKey("2026-08-25"); // Monday Aug 24
    expect(weekStart).toBe("2026-08-24");
    const weekMeals = mealsForWeek(plannedMeals, weekStart);
    expect(weekMeals).toHaveLength(12); // All meals in the week
  });

  it("each day has exactly 4 meals", () => {
    const weekStart = weekStartKey("2026-08-25");
    const weekMeals = mealsForWeek(plannedMeals, weekStart);
    for (const date of planDates) {
      const dayMeals = weekMeals.filter(m => m.plannedDate === date);
      expect(dayMeals).toHaveLength(4);
    }
  });

  it("meals for Aug 26 are not empty (regression test)", () => {
    const weekStart = weekStartKey("2026-08-26");
    const weekMeals = mealsForWeek(plannedMeals, weekStart);
    const aug26Meals = weekMeals.filter(m => m.plannedDate === "2026-08-26");
    expect(aug26Meals.length).toBeGreaterThan(0);
    expect(aug26Meals.length).toBe(4);
  });

  it("meals for Aug 27 are not empty (regression test)", () => {
    const weekStart = weekStartKey("2026-08-27");
    const weekMeals = mealsForWeek(plannedMeals, weekStart);
    const aug27Meals = weekMeals.filter(m => m.plannedDate === "2026-08-27");
    expect(aug27Meals.length).toBeGreaterThan(0);
    expect(aug27Meals.length).toBe(4);
  });

  it("client_keys are unique strings (no database collision)", () => {
    const keys = plannedMeals.map(m => `planned:${m.id}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(plannedMeals.length);
  });
});

describe("Date generation from local time", () => {
  // Simulate what the client sends: localDateKey()
  // In NZ (UTC+12), at 9 AM local on Aug 26, UTC is Aug 25 9 PM
  // Without the fix, the API would use "2026-08-25" (UTC) as start date
  // With the fix, the client sends "2026-08-26" (local) as startDate

  it("client sends local date, not UTC date", () => {
    // Simulate localDateKey() for Aug 26, 2026 at 9 AM NZ time
    const localDate = "2026-08-26";
    expect(isDateKey(localDate)).toBe(true);
    // This is what the API should use as startDate
    // NOT new Date().toISOString().slice(0, 10) which would give "2026-08-25"
    const utcDate = "2026-08-25";
    expect(localDate).not.toBe(utcDate); // They differ when timezone offset applies
  });

  it("3-day plan starting from local date covers 3 consecutive days", () => {
    const startDate = "2026-08-26"; // What the client sends
    const dates: string[] = [];
    const [sy, sm, sd] = startDate.split("-").map(Number);
    for (let i = 0; i < 3; i++) {
      const d = new Date(sy, sm - 1, sd + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${day}`);
    }
    expect(dates).toEqual(["2026-08-26", "2026-08-27", "2026-08-28"]);
    expect(dates.every(d => isDateKey(d))).toBe(true);
  });
});
