import { describe, it, expect } from "vitest";
import {
  isDateKey,
  normalizeMealSlot,
  weekStartKey,
  shiftDateKey,
  weekDateKeys,
  mealsForWeek,
  mealSlots,
} from "../lib/weekly-plan";

describe("isDateKey", () => {
  it("accepts valid date keys", () => {
    expect(isDateKey("2026-08-20")).toBe(true);
    expect(isDateKey("2026-01-01")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isDateKey("2026-8-20")).toBe(false);
    expect(isDateKey("aug-20-2026")).toBe(false);
    expect(isDateKey("")).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });

  it("rejects impossible dates", () => {
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-13-01")).toBe(false);
  });
});

describe("normalizeMealSlot", () => {
  it("accepts valid slots", () => {
    expect(normalizeMealSlot("breakfast")).toBe("breakfast");
    expect(normalizeMealSlot("snack")).toBe("snack");
  });

  it("rejects invalid slots", () => {
    expect(normalizeMealSlot("brunch")).toBeUndefined();
    expect(normalizeMealSlot(undefined)).toBeUndefined();
  });
});

describe("weekStartKey", () => {
  it("returns Monday of the same week", () => {
    // Aug 20, 2026 is a Thursday
    expect(weekStartKey("2026-08-20")).toBe("2026-08-17"); // Monday
  });

  it("handles Sunday (end of week)", () => {
    // Aug 23, 2026 is a Sunday → should go back to Aug 17
    expect(weekStartKey("2026-08-23")).toBe("2026-08-17");
  });

  it("handles Monday (start of week)", () => {
    expect(weekStartKey("2026-08-17")).toBe("2026-08-17");
  });
});

describe("shiftDateKey", () => {
  it("shifts forward", () => {
    expect(shiftDateKey("2026-08-20", 1)).toBe("2026-08-21");
    expect(shiftDateKey("2026-08-20", 7)).toBe("2026-08-27");
  });

  it("shifts backward", () => {
    expect(shiftDateKey("2026-08-20", -1)).toBe("2026-08-19");
  });

  it("handles month boundaries", () => {
    expect(shiftDateKey("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("weekDateKeys", () => {
  it("returns 7 consecutive dates", () => {
    const keys = weekDateKeys("2026-08-17");
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe("2026-08-17");
    expect(keys[6]).toBe("2026-08-23");
  });
});

describe("mealsForWeek", () => {
  const meals = [
    { plannedDate: "2026-08-17", mealSlot: "breakfast" },
    { plannedDate: "2026-08-18", mealSlot: "lunch" },
    { plannedDate: "2026-08-24", mealSlot: "dinner" }, // next week
    { plannedDate: undefined, mealSlot: "snack" },
  ];

  it("filters meals to the given week", () => {
    const weekMeals = mealsForWeek(meals, "2026-08-17");
    expect(weekMeals).toHaveLength(2);
  });
});

describe("mealSlots", () => {
  it("has 4 slots in order", () => {
    expect(mealSlots).toEqual(["breakfast", "lunch", "dinner", "snack"]);
  });
});
