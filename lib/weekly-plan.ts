export const mealSlots = ["breakfast", "lunch", "dinner", "snack"] as const;

export type MealSlot = (typeof mealSlots)[number];

export const mealSlotLabels: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export type WeeklyPlannedMeal = {
  plannedDate?: string;
  mealSlot?: MealSlot;
};

export function isDateKey(value: unknown): value is string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function normalizeMealSlot(value: unknown): MealSlot | undefined {
  return mealSlots.includes(value as MealSlot) ? value as MealSlot : undefined;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function weekStartKey(dateOrKey: Date | string = new Date()) {
  const date = typeof dateOrKey === "string" ? dateFromKey(dateOrKey) : new Date(dateOrKey);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return dateKey(date);
}

export function shiftDateKey(key: string, days: number) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function weekDateKeys(startKey: string) {
  return Array.from({ length: 7 }, (_, index) => shiftDateKey(startKey, index));
}

export function mealsForWeek<T extends WeeklyPlannedMeal>(meals: T[], startKey: string) {
  const dates = new Set(weekDateKeys(startKey));
  return meals.filter(meal => meal.plannedDate && dates.has(meal.plannedDate));
}
