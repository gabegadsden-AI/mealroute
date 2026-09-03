import { type PlannedIngredient } from "./grocery-list";
import { type Micronutrients, EMPTY_MICRONUTRIENTS, addMicronutrients } from "./micronutrients";
import { type MealRouteProfile } from "./profile";
import {
  isDateKey,
  normalizeMealSlot,
  shiftDateKey,
  weekStartKey,
  type MealSlot,
} from "./weekly-plan";

export type Tab = "today" | "plan" | "log" | "grocery" | "recipes" | "progress";
export type PlanSubView = "week" | "palette" | "review";
export type Meal = { id: number; type: string; name: string; calories: number; protein: number; carbs: number; fat: number; time: string; eaten: boolean; locked?: boolean; color: string; ingredients?: PlannedIngredient[]; plannedDate?: string; mealSlot?: MealSlot; micros?: Micronutrients };
export type LabelNutrition = { productName: string; energyValue: number; energyUnit: "kcal" | "kJ"; carbs: number; protein: number; fat: number; fibre: number };
export type SavedPackagedProduct = LabelNutrition & { id: string; updatedAt: number };
export type LabelNutritionDraft = Omit<LabelNutrition, "energyValue" | "carbs" | "protein" | "fat" | "fibre"> & { energyValue: number | ""; carbs: number | ""; protein: number | ""; fat: number | ""; fibre: number | "" };
export type AnalysisIngredient = { name: string; amountGrams: number; calories: number; protein: number; carbs: number; fat: number; fibre: number; nutritionSource?: string; calculationSource?: "nutrition_label" | "usda"; fdcId?: number; labelNutrition?: LabelNutrition; micros?: Micronutrients };
export type FoodAnalysis = {
  mealName: string;
  calories: { low: number; high: number; best: number };
  protein: number; carbs: number; fat: number; fibre: number;
  ingredients: AnalysisIngredient[];
  confidence: "High" | "Medium" | "Low";
  uncertainties: string[];
  clarifyingQuestions: string[];
  notes: string;
  calculationMethod?: "verified_database" | "nutrition_label" | "mixed_sources" | "ai_estimate";
};
export type ReviewIngredient = Omit<AnalysisIngredient, "amountGrams" | "labelNutrition"> & { amountGrams: number | ""; labelNutrition?: LabelNutritionDraft };
export type MealReview = {
  ingredients: ReviewIngredient[];
};
export type MealHistory = Record<string, Meal[]>;
export type StoredMealHistory = { version: 2; days: MealHistory; planned: Meal[] };
export type LegacyImportData = StoredMealHistory & { savedProducts: SavedPackagedProduct[] };
export type ProfileGoalUpdate = Pick<
  MealRouteProfile,
  "weight_kg" | "height_cm" | "weight_unit" | "height_unit" | "primary_goal" | "activity_level" | "calorie_goal" | "suggested_calorie_goal"
>;
export type ProfileMacroUpdate = Pick<
  MealRouteProfile,
  "protein_goal_g" | "carbs_goal_g" | "fat_goal_g" | "macro_targets_custom"
>;
export type ProfileDietaryUpdate = Pick<
  MealRouteProfile,
  "diet_type" | "allergies"
>;
export type ProfileNotificationsUpdate = Pick<
  MealRouteProfile,
  "notification_prefs"
>;
export type WeightSaveResult = {
  error: string;
  profileUpdated: boolean;
};

export const SAVED_PRODUCTS_KEY = "mealroute:saved-packaged-products:v1";
export const DAILY_MEALS_KEY = "mealroute:daily-meals:v1";
export const MEAL_HISTORY_KEY = "mealroute:meal-history:v2";
export const LEGACY_IMPORT_DECISION_KEY = "mealroute:legacy-import-decision:v1";
export const GROCERY_WEEK_KEY = "mealroute:grocery-week:v1";

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, Math.max(0, month - 1), day || 1);
}

export function weekRangeLabel(startKey: string) {
  const normalizedStart = weekStartKey(startKey);
  const start = dateFromKey(normalizedStart);
  const end = dateFromKey(shiftDateKey(normalizedStart, 6));
  const startMonth = start.toLocaleDateString([], { month: "long" });
  const endMonth = end.toLocaleDateString([], { month: "long" });

  if (start.getFullYear() !== end.getFullYear()) {
    return `${startMonth} ${start.getDate()}, ${start.getFullYear()}–${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${startMonth} ${start.getDate()}–${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${startMonth} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
}

export function numericValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

export function nutritionValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round((number + Number.EPSILON) * 10) / 10) : 0;
}

export function normalizeStoredIngredients(raw: unknown): PlannedIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      name: String(item?.name || "").replace(/\s+/g, " ").trim().slice(0, 160),
      amountGrams: nutritionValue(item?.amountGrams),
    }))
    .filter(item => item.name && item.amountGrams > 0 && item.amountGrams <= 5000);
}

export function normalizeStoredMeal(raw: any): Meal | null {
  if (!raw || !Number.isFinite(Number(raw.id)) || !String(raw.name || "").trim()) return null;
  const numbers = ["calories", "protein", "carbs", "fat"].map(key => Number(raw[key]));
  if (numbers.some(value => !Number.isFinite(value) || value < 0)) return null;
  return {
    id: Number(raw.id),
    type: String(raw.type || "Logged meal"),
    name: String(raw.name),
    calories: numbers[0],
    protein: numbers[1],
    carbs: numbers[2],
    fat: numbers[3],
    time: String(raw.time || ""),
    eaten: Boolean(raw.eaten),
    locked: raw.locked ? true : undefined,
    color: String(raw.color || "salmon"),
    ingredients: normalizeStoredIngredients(raw.ingredients),
    plannedDate: isDateKey(raw.plannedDate) ? raw.plannedDate : undefined,
    mealSlot: normalizeMealSlot(raw.mealSlot),
    micros: raw.micros && typeof raw.micros === "object" ? raw.micros as Micronutrients : undefined,
  };
}

export function normalizeMealList(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeStoredMeal).filter((meal: Meal | null): meal is Meal => Boolean(meal));
}

export function normalizeStoredHistory(raw: any): StoredMealHistory | null {
  if (raw?.version !== 2 || !raw.days || typeof raw.days !== "object" || Array.isArray(raw.days)) return null;
  const days: MealHistory = {};
  Object.entries(raw.days).forEach(([date, meals]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) days[date] = normalizeMealList(meals);
  });
  return { version: 2, days, planned: normalizeMealList(raw.planned) };
}

export function userStorageKey(base: string, userId: string) {
  return `${base}:user:${userId}`;
}

export function readStorageJson(key: string, fallback: unknown) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

export function persistMealHistory(days: MealHistory, planned: Meal[], storageKey: string) {
  try {
    const payload = JSON.stringify({ version: 2, days, planned });
    window.localStorage.setItem(storageKey, payload);
    return window.localStorage.getItem(storageKey) === payload;
  } catch {
    return false;
  }
}

export function normalizeSavedProducts(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(item => item?.id && item?.productName)
    .map(item => ({
      id: String(item.id),
      productName: String(item.productName),
      energyValue: nutritionValue(item.energyValue),
      energyUnit: item.energyUnit === "kJ" ? "kJ" as const : "kcal" as const,
      carbs: nutritionValue(item.carbs),
      protein: nutritionValue(item.protein),
      fat: nutritionValue(item.fat),
      fibre: nutritionValue(item.fibre),
      updatedAt: Number.isFinite(Number(item.updatedAt)) ? Number(item.updatedAt) : Date.now(),
    }));
}

export function readLegacyImportData(): LegacyImportData {
  const today = localDateKey();
  let history = normalizeStoredHistory(readStorageJson(MEAL_HISTORY_KEY, null));

  if (!history) {
    const legacy = readStorageJson(DAILY_MEALS_KEY, null) as any;
    const legacyDate = /^\d{4}-\d{2}-\d{2}$/.test(String(legacy?.date || "")) ? String(legacy.date) : today;
    const legacyMeals = normalizeMealList(legacy?.meals);
    history = {
      version: 2,
      days: legacyMeals.length ? { [legacyDate]: legacyMeals.filter(meal => meal.type !== "Planned meal") } : {},
      planned: legacyMeals.filter(meal => meal.type === "Planned meal"),
    };
  }

  const savedProducts = normalizeSavedProducts(readStorageJson(SAVED_PRODUCTS_KEY, []));
  return { ...history, savedProducts };
}

export function hasLegacyImportData(data: LegacyImportData) {
  return Object.values(data.days).some(meals => meals.length > 0)
    || data.planned.length > 0
    || data.savedProducts.length > 0;
}

export function mergeMealLists(current: Meal[], incoming: Meal[]) {
  const byId = new Map(current.map(meal => [meal.id, meal]));
  incoming.forEach(meal => {
    if (!byId.has(meal.id)) byId.set(meal.id, meal);
  });
  return Array.from(byId.values());
}

export function mergeMealHistory(current: MealHistory, incoming: MealHistory) {
  const merged = { ...current };
  Object.entries(incoming).forEach(([date, meals]) => {
    merged[date] = mergeMealLists(merged[date] || [], meals);
  });
  return merged;
}

export function mergeSavedProducts(current: SavedPackagedProduct[], incoming: SavedPackagedProduct[]) {
  const byId = new Map(current.map(product => [product.id, product]));
  incoming.forEach(product => {
    const existing = byId.get(product.id);
    if (!existing || product.updatedAt > existing.updatedAt) byId.set(product.id, product);
  });
  return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
}

export function mealTotals(meals: Meal[]) {
  return meals.filter(meal => meal.eaten).reduce((totals, meal) => ({
    calories: totals.calories + meal.calories,
    protein: totals.protein + meal.protein,
    carbs: totals.carbs + meal.carbs,
    fat: totals.fat + meal.fat,
    micros: addMicronutrients(totals.micros, meal.micros || EMPTY_MICRONUTRIENTS),
    count: totals.count + 1,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, micros: { ...EMPTY_MICRONUTRIENTS }, count: 0 });
}

export function normalizeLabel(raw: any): LabelNutrition | undefined {
  if (!raw) return undefined;
  const values = [raw.energyValue, raw.carbs, raw.protein, raw.fat, raw.fibre].map(Number);
  if (!(values[0] > 0) || values.some(value => !Number.isFinite(value) || value < 0)) return undefined;
  return { productName: String(raw.productName || "Packaged food"), energyValue: values[0], energyUnit: raw.energyUnit === "kJ" ? "kJ" : "kcal", carbs: values[1], protein: values[2], fat: values[3], fibre: values[4] };
}

export function gramValue(ingredient: any) {
  const direct = numericValue(ingredient?.amountGrams);
  if (direct > 0) return direct;
  const legacyMatch = String(ingredient?.amount || "").match(/\d+(?:\.\d+)?/);
  return legacyMatch ? Math.max(1, Math.round(Number(legacyMatch[0]))) : 0;
}

export function normalizeAnalysis(raw: any, review?: MealReview): FoodAnalysis {
  const returnedIngredients = Array.isArray(raw?.ingredients) ? raw.ingredients : [];
  const ingredients = review
    ? review.ingredients.map((confirmed, index) => {
        const nameMatch = returnedIngredients.find((item: any) => String(item?.name || "").trim().toLowerCase() === confirmed.name.trim().toLowerCase());
        const calculated = nameMatch || returnedIngredients[index] || {};
        return {
          name: confirmed.name,
          amountGrams: confirmed.amountGrams,
          calories: numericValue(calculated.calories),
          protein: nutritionValue(calculated.protein), carbs: nutritionValue(calculated.carbs), fat: nutritionValue(calculated.fat), fibre: nutritionValue(calculated.fibre),
          nutritionSource: String(calculated.nutritionSource || confirmed.nutritionSource || "") || undefined,
          calculationSource: calculated.calculationSource || confirmed.calculationSource,
          fdcId: Number.isFinite(Number(calculated.fdcId ?? confirmed.fdcId)) ? Number(calculated.fdcId ?? confirmed.fdcId) : undefined,
          labelNutrition: normalizeLabel(calculated.labelNutrition || confirmed.labelNutrition),
        };
      })
    : returnedIngredients.map((ingredient: any) => ({
        name: String(ingredient?.name || "Food"),
        amountGrams: gramValue(ingredient),
        calories: numericValue(ingredient?.calories),
        protein: nutritionValue(ingredient?.protein), carbs: nutritionValue(ingredient?.carbs), fat: nutritionValue(ingredient?.fat), fibre: nutritionValue(ingredient?.fibre),
        nutritionSource: String(ingredient?.nutritionSource || "") || undefined, calculationSource: ingredient?.calculationSource,
        fdcId: Number.isFinite(Number(ingredient?.fdcId)) ? Number(ingredient.fdcId) : undefined, labelNutrition: normalizeLabel(ingredient?.labelNutrition),
      }));

  return {
    ...raw,
    mealName: String(raw?.mealName || "Scanned meal"),
    calories: {
      low: numericValue(raw?.calories?.low),
      high: numericValue(raw?.calories?.high),
      best: numericValue(raw?.calories?.best),
    },
    protein: nutritionValue(raw?.protein), carbs: nutritionValue(raw?.carbs), fat: nutritionValue(raw?.fat), fibre: nutritionValue(raw?.fibre),
    ingredients,
    confidence: ["High", "Medium", "Low"].includes(raw?.confidence) ? raw.confidence : "Low",
    uncertainties: Array.isArray(raw?.uncertainties) ? raw.uncertainties : [],
    clarifyingQuestions: Array.isArray(raw?.clarifyingQuestions) ? raw.clarifyingQuestions : [],
    notes: String(raw?.notes || ""),
    calculationMethod: ["verified_database", "nutrition_label", "mixed_sources"].includes(raw?.calculationMethod) ? raw.calculationMethod : "ai_estimate",
  };
}
