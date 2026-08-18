"use client";
import ProfileCompletionBanner from "./components/ProfileCompletionBanner";

import LegalFooter from "./components/LegalFooter";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadCloudState,
  setLocalImportStatus,
  syncCloudMeals,
  syncCloudProducts,
} from "../lib/cloud-data";
import {
  activityLabels,
  cmToImperial,
  goalLabels,
  suggestedCalories,
  type Activity,
  type Goal,
} from "../lib/calorie-goal";
import {
  macroCalories,
  macroPercentages,
  suggestedMacroTargets,
  type MacroTargets,
} from "../lib/macro-targets";
import {
  calculateManualNutrition,
  customFoodKey,
  loadRecentFoods,
  packagedProductFood,
  saveRecentFood,
  type ManualFoodItem,
} from "../lib/manual-food";
import {
  createCustomGroceryItem,
  deleteCustomGroceryItem,
  reconcilePlannedGroceryItems,
  setGroceryItemChecked,
  sortGroceryItems,
  type GroceryCategory,
  type GroceryItem,
  type GroceryUnit,
  type PlannedIngredient,
} from "../lib/grocery-list";
import { profileSelect, type NutriPathProfile } from "../lib/profile";
import { createClient } from "../lib/supabase/client";
import {
  loadWeightLogs,
  removeWeightLog,
  upsertWeightLog,
  weightInUnit,
  weightToKg,
  type WeightLog,
} from "../lib/weight-progress";
import {
  DEFAULT_WATER_GOAL_ML,
  MAX_DAILY_WATER_ML,
  MAX_WATER_GOAL_ML,
  MIN_WATER_GOAL_ML,
  loadWaterDays,
  upsertWaterDay,
  waterDaysByDate,
  type WaterDay,
} from "../lib/water-tracking";
import {
  isDateKey,
  mealSlotLabels,
  mealSlots,
  mealsForWeek,
  normalizeMealSlot,
  shiftDateKey,
  weekDateKeys,
  weekStartKey,
  type MealSlot,
} from "../lib/weekly-plan";
import {
  loadFoodPreferences,
  addFoodPreference,
  deleteFoodPreference,
  updateFoodPreferenceSlots,
  type FoodPreference,
} from "../lib/food-preferences";
import FoodPalette, { type PaletteFood } from "./components/FoodPalette";
import PlanReview, { type PlanMeal, type GeneratedPlan } from "./components/PlanReview";

type Tab = "today" | "plan" | "log" | "grocery" | "progress";
type PlanSubView = "week" | "palette" | "review";
type Meal = { id: number; type: string; name: string; calories: number; protein: number; carbs: number; fat: number; time: string; eaten: boolean; locked?: boolean; color: string; ingredients?: PlannedIngredient[]; plannedDate?: string; mealSlot?: MealSlot };
type LabelNutrition = { productName: string; energyValue: number; energyUnit: "kcal" | "kJ"; carbs: number; protein: number; fat: number; fibre: number };
type SavedPackagedProduct = LabelNutrition & { id: string; updatedAt: number };
type LabelNutritionDraft = Omit<LabelNutrition, "energyValue" | "carbs" | "protein" | "fat" | "fibre"> & { energyValue: number | ""; carbs: number | ""; protein: number | ""; fat: number | ""; fibre: number | "" };
type AnalysisIngredient = { name: string; amountGrams: number; calories: number; protein: number; carbs: number; fat: number; fibre: number; nutritionSource?: string; calculationSource?: "nutrition_label" | "usda"; fdcId?: number; labelNutrition?: LabelNutrition };
type FoodAnalysis = {
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
type ReviewIngredient = Omit<AnalysisIngredient, "amountGrams" | "labelNutrition"> & { amountGrams: number | ""; labelNutrition?: LabelNutritionDraft };
type MealReview = {
  ingredients: ReviewIngredient[];
};
type MealHistory = Record<string, Meal[]>;
type StoredMealHistory = { version: 2; days: MealHistory; planned: Meal[] };
type LegacyImportData = StoredMealHistory & { savedProducts: SavedPackagedProduct[] };
type ProfileGoalUpdate = Pick<
  NutriPathProfile,
  "weight_kg" | "height_cm" | "weight_unit" | "height_unit" | "primary_goal" | "activity_level" | "calorie_goal" | "suggested_calorie_goal"
>;
type ProfileMacroUpdate = Pick<
  NutriPathProfile,
  "protein_goal_g" | "carbs_goal_g" | "fat_goal_g" | "macro_targets_custom"
>;
type WeightSaveResult = {
  error: string;
  profileUpdated: boolean;
};

const SAVED_PRODUCTS_KEY = "nutripath:saved-packaged-products:v1";
const DAILY_MEALS_KEY = "nutripath:daily-meals:v1";
const MEAL_HISTORY_KEY = "nutripath:meal-history:v2";
const LEGACY_IMPORT_DECISION_KEY = "nutripath:legacy-import-decision:v1";
const GROCERY_WEEK_KEY = "nutripath:grocery-week:v1";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekRangeLabel(startKey: string) {
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

function normalizeStoredMeal(raw: any): Meal | null {
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
  };
}

function normalizeStoredIngredients(raw: unknown): PlannedIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      name: String(item?.name || "").replace(/\s+/g, " ").trim().slice(0, 160),
      amountGrams: nutritionValue(item?.amountGrams),
    }))
    .filter(item => item.name && item.amountGrams > 0 && item.amountGrams <= 5000);
}

function normalizeMealList(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeStoredMeal).filter((meal: Meal | null): meal is Meal => Boolean(meal));
}

function normalizeStoredHistory(raw: any): StoredMealHistory | null {
  if (raw?.version !== 2 || !raw.days || typeof raw.days !== "object" || Array.isArray(raw.days)) return null;
  const days: MealHistory = {};
  Object.entries(raw.days).forEach(([date, meals]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) days[date] = normalizeMealList(meals);
  });
  return { version: 2, days, planned: normalizeMealList(raw.planned) };
}

function userStorageKey(base: string, userId: string) {
  return `${base}:user:${userId}`;
}

function readStorageJson(key: string, fallback: unknown) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function persistMealHistory(days: MealHistory, planned: Meal[], storageKey: string) {
  try {
    const payload = JSON.stringify({ version: 2, days, planned });
    window.localStorage.setItem(storageKey, payload);
    return window.localStorage.getItem(storageKey) === payload;
  } catch {
    return false;
  }
}

function normalizeSavedProducts(raw: unknown) {
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

function readLegacyImportData(): LegacyImportData {
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

function hasLegacyImportData(data: LegacyImportData) {
  return Object.values(data.days).some(meals => meals.length > 0)
    || data.planned.length > 0
    || data.savedProducts.length > 0;
}

function mergeMealLists(current: Meal[], incoming: Meal[]) {
  const byId = new Map(current.map(meal => [meal.id, meal]));
  incoming.forEach(meal => {
    if (!byId.has(meal.id)) byId.set(meal.id, meal);
  });
  return Array.from(byId.values());
}

function mergeMealHistory(current: MealHistory, incoming: MealHistory) {
  const merged = { ...current };
  Object.entries(incoming).forEach(([date, meals]) => {
    merged[date] = mergeMealLists(merged[date] || [], meals);
  });
  return merged;
}

function mergeSavedProducts(current: SavedPackagedProduct[], incoming: SavedPackagedProduct[]) {
  const byId = new Map(current.map(product => [product.id, product]));
  incoming.forEach(product => {
    const existing = byId.get(product.id);
    if (!existing || product.updatedAt > existing.updatedAt) byId.set(product.id, product);
  });
  return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, Math.max(0, month - 1), day || 1);
}

function mealTotals(meals: Meal[]) {
  return meals.filter(meal => meal.eaten).reduce((totals, meal) => ({
    calories: totals.calories + meal.calories,
    protein: totals.protein + meal.protein,
    carbs: totals.carbs + meal.carbs,
    fat: totals.fat + meal.fat,
    count: totals.count + 1,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
}

function numericValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function nutritionValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round((number + Number.EPSILON) * 10) / 10) : 0;
}

function normalizeLabel(raw: any): LabelNutrition | undefined {
  if (!raw) return undefined;
  const values = [raw.energyValue, raw.carbs, raw.protein, raw.fat, raw.fibre].map(Number);
  if (!(values[0] > 0) || values.some(value => !Number.isFinite(value) || value < 0)) return undefined;
  return { productName: String(raw.productName || "Packaged food"), energyValue: values[0], energyUnit: raw.energyUnit === "kJ" ? "kJ" : "kcal", carbs: values[1], protein: values[2], fat: values[3], fibre: values[4] };
}

function gramValue(ingredient: any) {
  const direct = numericValue(ingredient?.amountGrams);
  if (direct > 0) return direct;
  const legacyMatch = String(ingredient?.amount || "").match(/\d+(?:\.\d+)?/);
  return legacyMatch ? Math.max(1, Math.round(Number(legacyMatch[0]))) : 0;
}

function normalizeAnalysis(raw: any, review?: MealReview): FoodAnalysis {
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

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "⌂" }, { id: "plan", label: "My Plan", icon: "▦" },
  { id: "log", label: "Log Food", icon: "+" }, { id: "grocery", label: "Grocery", icon: "✓" },
  { id: "progress", label: "History", icon: "↗" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [profile, setProfile] = useState<NutriPathProfile | null>(null);
  const [userId, setUserId] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [mealHistory, setMealHistory] = useState<MealHistory>({});
  const [plannedMeals, setPlannedMeals] = useState<Meal[]>([]);
  const [planWeekStart, setPlanWeekStart] = useState("");
  const [groceryWeekStart, setGroceryWeekStart] = useState("");
  const [savedProducts, setSavedProducts] = useState<SavedPackagedProduct[]>([]);
  const [recentFoods, setRecentFoods] = useState<ManualFoodItem[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [waterHistory, setWaterHistory] = useState<Record<string, WaterDay>>({});
  const [legacyImport, setLegacyImport] = useState<LegacyImportData | null>(null);
  const [importingLegacy, setImportingLegacy] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [modal, setModal] = useState<null | "water" | "log" | "scan" | "clarify" | "result" | "profile" | "goals" | "macros" | "weight" | "manual">(null);
  const [manualStartMode, setManualStartMode] = useState<"search" | "saved" | "custom">("search");
  const [manualInitialFood, setManualInitialFood] = useState<ManualFoodItem | null>(null);
  const [toast, setToast] = useState("");
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [groceryReady, setGroceryReady] = useState(false);
  const [range, setRange] = useState("Week");
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [uploadedData, setUploadedData] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [foodPalette, setFoodPalette] = useState<FoodPreference[]>([]);
  const [planSubView, setPlanSubView] = useState<PlanSubView>("week");
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [planError, setPlanError] = useState("");

  const meals = selectedDate ? mealHistory[selectedDate] || [] : [];
  const totals = mealTotals(meals);
  const consumed = totals.calories;
  const protein = totals.protein;
  const carbs = totals.carbs;
  const fat = totals.fat;
  const water = selectedDate ? waterHistory[selectedDate]?.amount_ml || 0 : 0;
  const waterGoal = Number(profile?.water_goal_ml || DEFAULT_WATER_GOAL_ML);
  const target = Number(profile?.calorie_goal || profile?.suggested_calorie_goal || 1850);
  const suggestedMacros = useMemo(
    () => suggestedMacroTargets(target, profile?.primary_goal || null),
    [target, profile?.primary_goal],
  );
  const macroTargets = useMemo<MacroTargets>(() => {
    if (
      profile?.macro_targets_custom
      && profile.protein_goal_g !== null
      && profile.carbs_goal_g !== null
      && profile.fat_goal_g !== null
      && Number(profile.protein_goal_g) >= 0
      && Number(profile.carbs_goal_g) >= 0
      && Number(profile.fat_goal_g) >= 0
    ) {
      return {
        protein: Number(profile.protein_goal_g),
        carbs: Number(profile.carbs_goal_g),
        fat: Number(profile.fat_goal_g),
      };
    }
    return suggestedMacros;
  }, [profile?.macro_targets_custom, profile?.protein_goal_g, profile?.carbs_goal_g, profile?.fat_goal_g, suggestedMacros]);
  const pct = Math.min(100, Math.round((consumed / target) * 100));

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        window.location.replace("/auth/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(profileSelect)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (!active) return;
      if (error) {
        notify("Your profile could not be loaded. Please refresh and try again.");
        return;
      }
      if (!data?.onboarding_completed) {
        window.location.replace("/onboarding");
        return;
      }

      const loadedProfile = data as NutriPathProfile;
      const today = localDateKey();
      const currentPlanWeek = weekStartKey(today);
      const historyCacheKey = userStorageKey(MEAL_HISTORY_KEY, userData.user.id);
      const productsCacheKey = userStorageKey(SAVED_PRODUCTS_KEY, userData.user.id);
      const groceryWeekCacheKey = userStorageKey(GROCERY_WEEK_KEY, userData.user.id);
      let initialGroceryWeek = currentPlanWeek;
      try {
        const storedGroceryWeek = window.localStorage.getItem(groceryWeekCacheKey);
        if (isDateKey(storedGroceryWeek)) initialGroceryWeek = weekStartKey(storedGroceryWeek);
      } catch {
        // The current week remains available when browser storage is unavailable.
      }

      setProfile(loadedProfile);
      setUserId(userData.user.id);
      setSelectedDate(today);
      setPlanWeekStart(currentPlanWeek);
      setGroceryWeekStart(initialGroceryWeek);

      try {
        const cloud = await loadCloudState(supabase, userData.user.id);
        if (!active) return;
        const cloudDays = cloud.days as MealHistory;
        if (!cloudDays[today]) cloudDays[today] = [];
        const cloudPlan = cloud.planned as Meal[];
        const cloudProducts = cloud.savedProducts as SavedPackagedProduct[];
        setMealHistory(cloudDays);
        setPlannedMeals(cloudPlan);
        setSavedProducts(cloudProducts);
        try {
          const accountGrocery = await reconcilePlannedGroceryItems(supabase, userData.user.id, mealsForWeek(cloudPlan, initialGroceryWeek));
          if (!active) return;
          setGroceryItems(accountGrocery);
        } catch {
          if (!active) return;
          notify("Your grocery list could not be loaded. Your meals and plan are still available.");
        } finally {
          if (active) setGroceryReady(true);
        }
        persistMealHistory(cloudDays, cloudPlan, historyCacheKey);
        try {
          window.localStorage.setItem(productsCacheKey, JSON.stringify(cloudProducts));
        } catch {
          // Supabase remains the source of truth when browser storage is unavailable.
        }
      } catch {
        if (!active) return;
        const cachedHistory = normalizeStoredHistory(readStorageJson(historyCacheKey, null));
        const cachedProducts = normalizeSavedProducts(readStorageJson(productsCacheKey, []));
        const cachedDays = cachedHistory?.days || { [today]: [] };
        if (!cachedDays[today]) cachedDays[today] = [];
        setMealHistory(cachedDays);
        setPlannedMeals(cachedHistory?.planned || []);
        setSavedProducts(cachedProducts);
        setGroceryReady(true);
        notify("Cloud data is temporarily unavailable. Showing this account’s last saved copy.");
      }

      try {
        const cloudWeightLogs = await loadWeightLogs(supabase, userData.user.id);
        if (!active) return;
        setWeightLogs(cloudWeightLogs);
      } catch {
        if (!active) return;
        notify("Weight history could not be loaded. Your meals and targets are still available.");
      }

      try {
        const cloudWaterDays = await loadWaterDays(supabase, userData.user.id);
        if (!active) return;
        setWaterHistory(waterDaysByDate(cloudWaterDays));
      } catch {
        if (!active) return;
        notify("Water history could not be loaded. Your meals and targets are still available.");
      }

      try {
        const cloudRecentFoods = await loadRecentFoods(supabase, userData.user.id);
        if (!active) return;
        setRecentFoods(cloudRecentFoods);
      } catch {
        if (!active) return;
        notify("Recent foods could not be loaded. Food search is still available.");
      }

      try {
        const cloudPalette = await loadFoodPreferences(supabase, userData.user.id);
        if (!active) return;
        setFoodPalette(cloudPalette);
      } catch {
        if (!active) return;
        // Food palette is optional — plan generation will prompt to add foods.
      }

      if (loadedProfile.local_import_status !== "imported") {
        try {
          const legacy = readLegacyImportData();
          const importDecision = window.localStorage.getItem(userStorageKey(LEGACY_IMPORT_DECISION_KEY, userData.user.id));
          if (hasLegacyImportData(legacy) && importDecision !== "skipped") {
            setLegacyImport(legacy);
          }
        } catch {
          notify("NutriPath could not check this browser for older data.");
        }
      }

      if (active) setDataReady(true);
    }

    void loadAccount();
    return () => {
      active = false;
    };
  }, []);

  async function handleAddPaletteFood(food: Omit<PaletteFood, "id">) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const added = await addFoodPreference(supabase, userData.user.id, {
      foodName: food.foodName,
      fdcId: food.fdcId,
      caloriesPer100g: food.caloriesPer100g,
      proteinPer100g: food.proteinPer100g,
      carbsPer100g: food.carbsPer100g,
      fatPer100g: food.fatPer100g,
      fibrePer100g: food.fibrePer100g,
      category: food.category,
      preferredSlots: food.preferredSlots,
    });
    setFoodPalette(prev => [...prev, added]);
    notify(`${food.foodName} added to your food palette`);
  }

  async function handleDeletePaletteFood(id: string) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await deleteFoodPreference(supabase, userData.user.id, id);
    setFoodPalette(prev => prev.filter(item => item.id !== id));
  }

  async function handleUpdatePaletteSlots(id: string, slots: string[]) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await updateFoodPreferenceSlots(supabase, userData.user.id, id, slots);
    setFoodPalette(prev => prev.map(item =>
      item.id === id ? { ...item, preferredSlots: slots } : item
    ));
    notify("Meal assignment saved");
  }

  async function handleGeneratePlan(days: number) {
    setGeneratingPlan(true);
    setPlanError("");
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      if (data.error) {
        setPlanError(data.error);
        return;
      }
      setGeneratedPlan(data as GeneratedPlan);
      setPlanSubView("review");
    } catch {
      setPlanError("Could not generate plan. Please try again.");
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function handleAcceptPlan(acceptedMeals?: PlanMeal[]) {
    if (!generatedPlan) return;
    const mealsToSave = acceptedMeals || generatedPlan.meals;
    const newPlanned: Meal[] = mealsToSave.map((meal: PlanMeal) => ({
      id: Date.now() + Math.random() * 100000,
      type: "Planned meal",
      name: meal.foodName,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      time: "",
      eaten: false,
      color: "salmon",
      plannedDate: meal.date,
      mealSlot: meal.slot as MealSlot,
    }));

    const mergedPlan = mergeMealLists(plannedMeals, newPlanned);
    setPlannedMeals(mergedPlan);
    const saved = await saveMealState(mealHistory, mergedPlan, "AI plan accepted and saved to your weekly plan");
    if (saved) await refreshGroceryForPlan(mergedPlan);

    setGeneratedPlan(null);
    setPlanSubView("week");
    notify(`Plan accepted! ${newPlanned.length} meals added to your weekly plan.`);
  }

  function handleRejectPlan() {
    setGeneratedPlan(null);
    setPlanSubView("week");
    notify("Plan discarded. Try generating again with different foods.");
  }

  function handleRegenerateMeal(date: string, slot: string) {
    // Phase 2: individual meal regeneration via AI
    // For now, just remove the meal from the generated plan
    if (!generatedPlan) return;
    const updated = {
      ...generatedPlan,
      meals: generatedPlan.meals.filter(m => !(m.date === date && m.slot === slot)),
    };
    // Recalculate daily totals
    const totalsMap = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
    for (const m of updated.meals) {
      const t = totalsMap.get(m.date) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
      t.calories += Math.round(m.calories);
      t.protein = Math.round((t.protein + m.protein) * 10) / 10;
      t.carbs = Math.round((t.carbs + m.carbs) * 10) / 10;
      t.fat = Math.round((t.fat + m.fat) * 10) / 10;
      totalsMap.set(m.date, t);
    }
    updated.dailyTotals = Array.from(totalsMap.entries()).map(([date, t]) => ({
      date,
      calories: Math.round(t.calories),
      protein: Math.round(t.protein * 10) / 10,
      carbs: Math.round(t.carbs * 10) / 10,
      fat: Math.round(t.fat * 10) / 10,
    }));
    setGeneratedPlan(updated);
    notify("Meal removed. Accept the plan without it or start over.");
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function saveMealState(days: MealHistory, planned: Meal[], successMessage: string) {
    if (!userId) {
      notify("Your account is still loading. Please try again.");
      return false;
    }
    const cacheSaved = persistMealHistory(days, planned, userStorageKey(MEAL_HISTORY_KEY, userId));
    try {
      await syncCloudMeals(createClient(), userId, days, planned);
      notify(successMessage);
      return true;
    } catch {
      notify(cacheSaved
        ? "Saved on this device. NutriPath will need another update to sync it to your account."
        : "This change could not be saved. Please check your connection and try again.");
      return false;
    }
  }

  async function refreshGroceryForPlan(planned: Meal[], startKey = planWeekStart || weekStartKey()) {
    if (!userId) return false;
    const activeStartKey = isDateKey(startKey) ? weekStartKey(startKey) : weekStartKey();
    try {
      const items = await reconcilePlannedGroceryItems(createClient(), userId, mealsForWeek(planned, activeStartKey));
      setGroceryItems(items);
      setGroceryWeekStart(activeStartKey);
      try {
        window.localStorage.setItem(userStorageKey(GROCERY_WEEK_KEY, userId), activeStartKey);
      } catch {
        // The displayed list remains correct for this session when browser storage is unavailable.
      }
      setGroceryReady(true);
      return true;
    } catch {
      notify("Your plan was saved, but the grocery list could not be refreshed.");
      return false;
    }
  }

  async function toggleGroceryItem(itemKey: string) {
    if (!userId) return;
    const current = groceryItems.find(item => item.itemKey === itemKey);
    if (!current) return;
    const nextChecked = !current.checked;
    setGroceryItems(items => items.map(item => item.itemKey === itemKey ? { ...item, checked: nextChecked } : item));
    try {
      await setGroceryItemChecked(createClient(), userId, itemKey, nextChecked);
    } catch {
      setGroceryItems(items => items.map(item => item.itemKey === itemKey ? { ...item, checked: current.checked } : item));
      notify("That grocery change could not be saved. Please try again.");
    }
  }

  async function addCustomGroceryItem(values: {
    name: string;
    quantity: number;
    unit: GroceryUnit;
    category: GroceryCategory;
  }) {
    if (!userId) return "Your account is still loading. Please try again.";
    const name = values.name.replace(/\s+/g, " ").trim();
    if (!name) return "Enter an item name.";
    if (name.length > 160) return "Keep the grocery item name under 160 characters.";
    if (!Number.isFinite(values.quantity) || values.quantity <= 0 || values.quantity > 100000) {
      return "Enter a quantity greater than zero.";
    }

    const item: GroceryItem = {
      itemKey: `custom:${crypto.randomUUID()}`,
      name,
      quantity: Math.round((values.quantity + Number.EPSILON) * 10) / 10,
      unit: values.unit,
      category: values.category,
      sourceType: "custom",
      checked: false,
    };
    try {
      const saved = await createCustomGroceryItem(createClient(), userId, item);
      setGroceryItems(items => sortGroceryItems([...items, saved]));
      notify(`${saved.name} added to your grocery list`);
      return "";
    } catch {
      return "This grocery item could not be saved. Please try again.";
    }
  }

  async function removeCustomGroceryItem(itemKey: string) {
    if (!userId) return;
    const existing = groceryItems.find(item => item.itemKey === itemKey && item.sourceType === "custom");
    if (!existing) return;
    setGroceryItems(items => items.filter(item => item.itemKey !== itemKey));
    try {
      await deleteCustomGroceryItem(createClient(), userId, itemKey);
      notify(`${existing.name} removed`);
    } catch {
      setGroceryItems(items => sortGroceryItems([...items, existing]));
      notify("That grocery item could not be removed. Please try again.");
    }
  }

  async function saveProductState(products: SavedPackagedProduct[]) {
    if (!userId) return;
    try {
      window.localStorage.setItem(userStorageKey(SAVED_PRODUCTS_KEY, userId), JSON.stringify(products));
    } catch {
      // Supabase remains the source of truth when browser storage is unavailable.
    }
    try {
      await syncCloudProducts(createClient(), userId, products);
    } catch {
      notify("The nutrition label was kept on this device, but account sync needs another update.");
    }
  }

  async function saveProfileGoals(values: ProfileGoalUpdate) {
    if (!userId) return "Your account is still loading. Please try again.";
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(values)
      .eq("user_id", userId)
      .select(profileSelect)
      .single();

    if (error || !data) {
      return "Your goals could not be saved. Please check your connection and try again.";
    }

    setProfile(data as NutriPathProfile);
    notify("Your goals and daily calorie target are updated");
    return "";
  }

  async function saveProfileMacros(values: ProfileMacroUpdate) {
    if (!userId) return "Your account is still loading. Please try again.";
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(values)
      .eq("user_id", userId)
      .select(profileSelect)
      .single();

    if (error || !data) {
      return "Your macro targets could not be saved. Please check your connection and try again.";
    }

    setProfile(data as NutriPathProfile);
    notify("Your protein, carbohydrate, and fat targets are updated");
    return "";
  }

  async function saveWeightEntry(loggedOn: string, weightKg: number): Promise<WeightSaveResult> {
    if (!userId) {
      return { error: "Your account is still loading. Please try again.", profileUpdated: false };
    }

    try {
      const supabase = createClient();
      const saved = await upsertWeightLog(supabase, userId, loggedOn, weightKg);
      const nextLogs = [...weightLogs.filter(log => log.logged_on !== saved.logged_on), saved]
        .sort((a, b) => a.logged_on.localeCompare(b.logged_on));
      setWeightLogs(nextLogs);

      const latest = nextLogs[nextLogs.length - 1];
      let profileUpdated = false;
      if (latest?.id === saved.id) {
        const { data, error } = await supabase
          .from("profiles")
          .update({ weight_kg: latest.weight_kg })
          .eq("user_id", userId)
          .select(profileSelect)
          .single();

        if (!error && data) {
          setProfile(data as NutriPathProfile);
          profileUpdated = true;
        }
      }

      notify("Weight saved to your account");
      return { error: "", profileUpdated };
    } catch {
      return {
        error: "Your weight could not be saved. Check your connection and try again.",
        profileUpdated: false,
      };
    }
  }

  async function deleteWeightEntry(logId: string) {
    if (!userId) return "Your account is still loading. Please try again.";

    try {
      const supabase = createClient();
      await removeWeightLog(supabase, userId, logId);
      const nextLogs = weightLogs.filter(log => log.id !== logId);
      setWeightLogs(nextLogs);

      const latest = nextLogs[nextLogs.length - 1];
      if (latest) {
        const { data, error } = await supabase
          .from("profiles")
          .update({ weight_kg: latest.weight_kg })
          .eq("user_id", userId)
          .select(profileSelect)
          .single();
        if (!error && data) setProfile(data as NutriPathProfile);
      }

      notify("Weight entry removed");
      return "";
    } catch {
      return "This weight entry could not be removed. Please try again.";
    }
  }

  async function importLegacyData() {
    if (!userId || !legacyImport || importingLegacy) return;
    setImportingLegacy(true);
    const mergedDays = mergeMealHistory(mealHistory, legacyImport.days);
    const mergedPlan = mergeMealLists(plannedMeals, legacyImport.planned);
    const mergedProducts = mergeSavedProducts(savedProducts, legacyImport.savedProducts);
    const supabase = createClient();

    try {
      await Promise.all([
        syncCloudMeals(supabase, userId, mergedDays, mergedPlan),
        syncCloudProducts(supabase, userId, mergedProducts),
      ]);
      await setLocalImportStatus(supabase, userId, "imported");
      setMealHistory(mergedDays);
      setPlannedMeals(mergedPlan);
      setSavedProducts(mergedProducts);
      await refreshGroceryForPlan(mergedPlan);
      setProfile(current => current ? { ...current, local_import_status: "imported" } : current);
      setLegacyImport(null);
      persistMealHistory(mergedDays, mergedPlan, userStorageKey(MEAL_HISTORY_KEY, userId));
      try {
        window.localStorage.setItem(userStorageKey(SAVED_PRODUCTS_KEY, userId), JSON.stringify(mergedProducts));
        window.localStorage.removeItem(MEAL_HISTORY_KEY);
        window.localStorage.removeItem(DAILY_MEALS_KEY);
        window.localStorage.removeItem(SAVED_PRODUCTS_KEY);
        window.localStorage.removeItem(userStorageKey(LEGACY_IMPORT_DECISION_KEY, userId));
      } catch {
        // The cloud import succeeded even if this browser blocks local storage cleanup.
      }
      notify("Your earlier NutriPath data is now saved to this account.");
    } catch {
      notify("Your earlier data could not be imported. Nothing was removed; please try again.");
    } finally {
      setImportingLegacy(false);
    }
  }

  async function skipLegacyImport() {
    if (!userId || importingLegacy) return;
    setImportingLegacy(true);
    try {
      await setLocalImportStatus(createClient(), userId, "skipped");
      try {
        window.localStorage.setItem(userStorageKey(LEGACY_IMPORT_DECISION_KEY, userId), "skipped");
      } catch {
        // The cloud status still records the user’s choice.
      }
      setProfile(current => current ? { ...current, local_import_status: "skipped" } : current);
      setLegacyImport(null);
      notify("This account will start with its own NutriPath data.");
    } catch {
      notify("NutriPath could not save that choice. Please try again.");
    } finally {
      setImportingLegacy(false);
    }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoggingOut(false);
      notify("NutriPath could not log you out. Please try again.");
      return;
    }
    window.location.replace("/auth/login");
  }

  async function markMeal(id: number) {
    const date = selectedDate || localDateKey();
    const nextMeals = (mealHistory[date] || []).map(meal => meal.id === id ? { ...meal, eaten: !meal.eaten } : meal);
    const nextHistory = { ...mealHistory, [date]: nextMeals };
    setMealHistory(nextHistory);
    await saveMealState(nextHistory, plannedMeals, "This day’s progress is saved to your account");
  }

  async function updatePlannedMealSchedule(id: number, plannedDate: string | null, mealSlot?: MealSlot) {
    if (plannedDate !== null && (!isDateKey(plannedDate) || !normalizeMealSlot(mealSlot))) {
      return "Choose a valid date and meal slot.";
    }
    const nextPlan = plannedMeals.map(meal => meal.id === id
      ? plannedDate === null
        ? { ...meal, plannedDate: undefined, mealSlot: undefined }
        : { ...meal, plannedDate, mealSlot }
      : meal);
    setPlannedMeals(nextPlan);
    const saved = await saveMealState(mealHistory, nextPlan, plannedDate === null ? "Meal returned to Unscheduled" : "Meal scheduled in your weekly plan");
    if (saved) await refreshGroceryForPlan(nextPlan);
    return saved ? "" : "The schedule was kept on this device, but account sync needs another update.";
  }

  async function removePlannedMeal(id: number) {
    const meal = plannedMeals.find(item => item.id === id);
    if (!meal) return;
    const nextPlan = plannedMeals.filter(item => item.id !== id);
    setPlannedMeals(nextPlan);
    const saved = await saveMealState(mealHistory, nextPlan, `${meal.name} removed from My Plan`);
    if (saved) await refreshGroceryForPlan(nextPlan);
  }

  async function logPlannedMeal(id: number) {
    const meal = plannedMeals.find(item => item.id === id);
    if (!meal) return;
    const today = localDateKey();
    const { plannedDate: _plannedDate, mealSlot, ...mealDetails } = meal;
    const loggedMeal: Meal = {
      ...mealDetails,
      id: Date.now(),
      type: mealSlot ? mealSlotLabels[mealSlot] : "Logged meal",
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      eaten: true,
      locked: undefined,
    };
    const nextHistory = { ...mealHistory, [today]: [...(mealHistory[today] || []), loggedMeal] };
    const nextPlan = plannedMeals.filter(item => item.id !== id);
    setMealHistory(nextHistory);
    setPlannedMeals(nextPlan);
    setSelectedDate(today);
    const saved = await saveMealState(nextHistory, nextPlan, `${meal.name} logged as eaten today`);
    if (saved) await refreshGroceryForPlan(nextPlan);
    setTab("today");
  }

  async function openWeeklyGrocery(startKey: string) {
    setPlanWeekStart(startKey);
    await refreshGroceryForPlan(plannedMeals, startKey);
    setTab("grocery");
  }

  async function saveWaterTotal(amountMl: number) {
    if (!userId) return "Your account is still loading. Please try again.";
    const date = selectedDate || localDateKey();
    const amount = Math.round(amountMl);
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_DAILY_WATER_ML) {
      return `Enter a daily total between 0 and ${MAX_DAILY_WATER_ML.toLocaleString()} ml.`;
    }

    const previous = waterHistory[date];
    setWaterHistory(current => ({
      ...current,
      [date]: previous
        ? { ...previous, amount_ml: amount }
        : { id: `pending-${date}`, user_id: userId, log_date: date, amount_ml: amount, created_at: "", updated_at: "" },
    }));

    try {
      const saved = await upsertWaterDay(createClient(), userId, date, amount);
      setWaterHistory(current => ({ ...current, [date]: saved }));
      notify(`Water saved for ${date === localDateKey() ? "today" : dateFromKey(date).toLocaleDateString([], { day: "numeric", month: "short" })}`);
      return "";
    } catch {
      setWaterHistory(current => {
        const next = { ...current };
        if (previous) next[date] = previous; else delete next[date];
        return next;
      });
      return "Your water total could not be saved. Check your connection and try again.";
    }
  }

  async function addWater(amountMl: number) {
    const nextTotal = water + Math.round(amountMl);
    if (!Number.isFinite(amountMl) || amountMl <= 0) return "Enter an amount greater than 0 ml.";
    if (nextTotal > MAX_DAILY_WATER_ML) {
      return `That would exceed NutriPath’s ${MAX_DAILY_WATER_ML.toLocaleString()} ml daily entry limit.`;
    }
    return saveWaterTotal(nextTotal);
  }

  async function saveWaterGoal(goalMl: number) {
    if (!userId) return "Your account is still loading. Please try again.";
    const goal = Math.round(goalMl);
    if (!Number.isFinite(goal) || goal < MIN_WATER_GOAL_ML || goal > MAX_WATER_GOAL_ML) {
      return `Enter a daily goal between ${MIN_WATER_GOAL_ML.toLocaleString()} and ${MAX_WATER_GOAL_ML.toLocaleString()} ml.`;
    }

    const { data, error } = await createClient()
      .from("profiles")
      .update({ water_goal_ml: goal })
      .eq("user_id", userId)
      .select(profileSelect)
      .single();
    if (error || !data) return "Your water goal could not be saved. Check your connection and try again.";
    setProfile(data as NutriPathProfile);
    notify("Your daily water goal is updated");
    return "";
  }

  async function usePhoto(file: File | undefined) {
    if (!file) return;
    setAnalysis(null);
    setAnalysisError("");
    setUploadedData(null);
    setModal("scan");
    let sourceUrl = "";
    try {
      const isHeic = /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
      let preparedFile: Blob = file;
      if (isHeic) {
        const { heicTo } = await import("heic-to/csp");
        preparedFile = await heicTo({ blob: file, type: "image/jpeg", quality: 0.86 });
      }
      setUploadedPhoto(current => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(preparedFile);
      });
      sourceUrl = URL.createObjectURL(preparedFile);
      const source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("This photo could not be decoded. Please choose a JPG, PNG, HEIC or HEIF image."));
        image.src = sourceUrl;
      });
      const maxDimension = 1400;
      const scale = Math.min(1, maxDimension / Math.max(source.naturalWidth, source.naturalHeight));
      const width = Math.max(1, Math.round(source.naturalWidth * scale));
      const height = Math.max(1, Math.round(source.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo processing is unavailable in this browser.");
      context.drawImage(source, 0, 0, width, height);
      setUploadedData(canvas.toDataURL("image/jpeg", 0.78));
    } catch (error) {
      const isHeic = /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
      setAnalysisError(error instanceof Error && !isHeic ? error.message : isHeic ? "This iPhone photo could not be converted. Please try Take a photo or upload a screenshot." : "This photo could not be prepared. Please choose another image.");
    } finally {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    }
  }

  async function analyzePhoto(answers: string[] = [], review?: MealReview) {
    if ((!uploadedData && !review) || analyzing) return;
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadedData, mode: review ? "review" : "analyze", answers, previousAnalysis: analysis, review }),
      });
      const responseText = await response.text();
      let payload: any;
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new Error(response.status === 413
          ? "This photo is still too large. Please move farther away and retake it."
          : `The analysis service returned an unexpected response (${response.status}). Please try again.`);
      }
      if (!response.ok) throw new Error(payload.error || "The photo could not be analyzed.");
      const nextAnalysis = normalizeAnalysis(payload.analysis, review);
      setAnalysis(nextAnalysis);
      setModal(!review && answers.length === 0 && nextAnalysis.clarifyingQuestions.length > 0 ? "clarify" : "result");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "The photo could not be analyzed.");
      setModal(review ? "result" : answers.length > 0 ? "clarify" : "scan");
    } finally {
      setAnalyzing(false);
    }
  }

  function openManualFood(
    mode: "search" | "saved" | "custom" = "search",
    food: ManualFoodItem | null = null,
  ) {
    setManualStartMode(mode);
    setManualInitialFood(food);
    setModal("manual");
  }

  async function addManualFood(
    food: ManualFoodItem,
    grams: number,
    destination: "today" | "plan",
  ) {
    if (!userId) {
      notify("Your account is still loading. Please try again.");
      return false;
    }

    const nutrition = calculateManualNutrition(food, grams);
    const nextMeal: Meal = {
      id: Date.now(),
      type: destination === "today" ? "Logged meal" : "Planned meal",
      name: `${food.name} · ${nutrition.grams}g`,
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      eaten: destination === "today",
      color: "wrap",
      ingredients: [{ name: food.name, amountGrams: nutrition.grams }],
    };

    let mealSaved: boolean;
    if (destination === "today") {
      const today = localDateKey();
      const nextHistory = { ...mealHistory, [today]: [...(mealHistory[today] || []), nextMeal] };
      setMealHistory(nextHistory);
      setSelectedDate(today);
      mealSaved = await saveMealState(nextHistory, plannedMeals, `${food.name} logged with ${nutrition.grams}g`);
    } else {
      const nextPlan = [...plannedMeals, nextMeal];
      setPlannedMeals(nextPlan);
      mealSaved = await saveMealState(mealHistory, nextPlan, `${food.name} added to My Plan with ${nutrition.grams}g`);
      if (mealSaved) await refreshGroceryForPlan(nextPlan);
    }

    if (mealSaved) {
      try {
        const previous = recentFoods.find(item => item.sourceKey === food.sourceKey);
        const saved = await saveRecentFood(createClient(), userId, food, previous?.timesUsed || 0, nutrition.grams);
        setRecentFoods(current => [
          saved,
          ...current.filter(item => item.sourceKey !== saved.sourceKey),
        ].slice(0, 30));
      } catch {
        notify("The meal was saved, but NutriPath could not update Recent foods.");
      }
    }

    setManualInitialFood(null);
    setModal(null);
    setTab(destination);
    return mealSaved;
  }

  async function addAnalyzedMeal(destination: "today" | "plan" = "today") {
    if (!analysis) return;
    const nextMeal = {
      id: Date.now(), type: destination === "today" ? "Logged meal" : "Planned meal", name: analysis.mealName,
      calories: analysis.calories.best, protein: analysis.protein, carbs: analysis.carbs, fat: analysis.fat,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      eaten: destination === "today", color: "salmon",
      ingredients: analysis.ingredients
        .filter(ingredient => ingredient.name.trim() && ingredient.amountGrams > 0)
        .map(ingredient => ({ name: ingredient.name.trim(), amountGrams: ingredient.amountGrams })),
    };
    let savePromise: Promise<boolean>;
    let nextPlannedMeals: Meal[] | null = null;
    if (destination === "today") {
      const today = localDateKey();
      const nextHistory = { ...mealHistory, [today]: [...(mealHistory[today] || []), nextMeal] };
      setMealHistory(nextHistory);
      setSelectedDate(today);
      savePromise = saveMealState(nextHistory, plannedMeals, `${analysis.mealName} logged and saved to your account`);
    } else {
      const nextPlan = [...plannedMeals, nextMeal];
      setPlannedMeals(nextPlan);
      nextPlannedMeals = nextPlan;
      savePromise = saveMealState(mealHistory, nextPlan, `${analysis.mealName} added to your plan and saved`);
    }
    setModal(null);
    setTab(destination);
    const mealSaved = await savePromise;
    if (mealSaved && nextPlannedMeals) await refreshGroceryForPlan(nextPlannedMeals);
  }

  const selectedDateLabel = selectedDate ? dateFromKey(selectedDate).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) : "";
  const activeGroceryWeek = isDateKey(groceryWeekStart) ? weekStartKey(groceryWeekStart) : weekStartKey();
  const groceryWeekLabel = weekRangeLabel(activeGroceryWeek);
  const topbarContext = tab === "grocery"
    ? `GROCERIES FOR ${groceryWeekLabel.toUpperCase()}`
    : selectedDateLabel ? selectedDateLabel.toUpperCase() : "YOUR NUTRITION";
  const title = tab === "today" ? !selectedDate || selectedDate === localDateKey() ? "Today" : selectedDateLabel : tab === "plan" ? "My Plan" : tab === "log" ? "Log Food" : tab === "grocery" ? "Grocery List" : "History";
  const legacyMealCount = legacyImport
    ? Object.values(legacyImport.days).reduce((count, dayMeals) => count + dayMeals.length, 0) + legacyImport.planned.length
    : 0;

  return (
    <main className="app-shell">
      <div className="desktop-rail">
        <Brand />
        <p className="rail-kicker">Your nutrition, made simpler.</p>
        <div className="rail-nav">
          {navItems.map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span>{item.label}</button>)}
        </div>
        <div className="rail-quote"><span>“</span><p>Small choices add up. Keep going{profile?.name ? `, ${profile.name}` : ""}.</p></div>
      </div>

      <section className="phone-app">
        <header className="topbar">
          <div className="mobile-brand"><Brand /></div>
          <div><p className="eyebrow">{topbarContext}</p><h1>{title}</h1></div>
          <button className="avatar" aria-label="Open profile" onClick={() => setModal("profile")}>{profileInitials(profile?.name)}</button>
        </header>

        <div className="content">
          {!dataReady
            ? <div className="history-empty"><strong>Loading your NutriPath account…</strong><span>Your meals, plan, History, and saved products are being restored securely.</span></div>
            : <>
              <ProfileCompletionBanner
                hasCalorieGoal={!!(profile?.calorie_goal && Number(profile.calorie_goal) > 0)}
                hasMacroGoals={profile?.protein_goal_g !== null && profile?.carbs_goal_g !== null && profile?.fat_goal_g !== null}
                onOpenGoals={() => setModal("goals")}
              />

              {tab === "today" && <Today meals={meals} selectedDate={selectedDate} onSelectDate={setSelectedDate} consumed={consumed} protein={protein} carbs={carbs} fat={fat} target={target} macroTargets={macroTargets} pct={pct} water={water} waterGoal={waterGoal} onMeal={markMeal} onWater={() => setModal("water")} onLog={() => setModal("log")} />}
              {tab === "plan" && (
                <>
                  <div className="plan-sub-nav" style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
                    <button className={planSubView === "week" ? "active" : ""} style={{
                      flex: 1, padding: "10px", borderRadius: "12px", fontSize: "11px", fontWeight: 700,
                      border: planSubView === "week" ? "1px solid var(--green)" : "1px solid #2c352f",
                      background: planSubView === "week" ? "rgba(169,244,122,0.1)" : "transparent",
                      color: planSubView === "week" ? "var(--green)" : "#8e9a91",
                    }} onClick={() => setPlanSubView("week")}>Weekly Plan</button>
                    <button className={planSubView === "palette" ? "active" : ""} style={{
                      flex: 1, padding: "10px", borderRadius: "12px", fontSize: "11px", fontWeight: 700,
                      border: planSubView === "palette" ? "1px solid var(--green)" : "1px solid #2c352f",
                      background: planSubView === "palette" ? "rgba(169,244,122,0.1)" : "transparent",
                      color: planSubView === "palette" ? "var(--green)" : "#8e9a91",
                    }} onClick={() => setPlanSubView("palette")}>My Foods ({foodPalette.length})</button>
                  </div>
                  {planSubView === "week" && (
                    <>
                      <div style={{
                        background: "linear-gradient(130deg,#1a241d,#101612)",
                        border: "1px solid #2d392f",
                        borderRadius: "22px",
                        padding: "20px",
                        marginBottom: "16px",
                      }}>
                        <p className="eyebrow" style={{ margin: "0 0 6px" }}>AI PLAN GENERATOR</p>
                        <h2 style={{ fontSize: "18px", margin: "0 0 8px", letterSpacing: "-.03em" }}>Let NutriPath plan your week</h2>
                        <p style={{ color: "#8e9a91", fontSize: "12px", margin: "0 0 14px", lineHeight: 1.5 }}>
                          {foodPalette.length < 3
                            ? "Add at least 3 foods to your palette, then generate a balanced meal plan in seconds."
                            : "Generate a balanced meal plan from your food palette, calibrated to your calorie and macro targets."}
                        </p>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {[3, 5, 7].map(d => (
                            <button key={d} disabled={generatingPlan || foodPalette.length < 3} onClick={() => void handleGeneratePlan(d)} style={{
                              flex: 1, padding: "12px", borderRadius: "14px", fontSize: "12px", fontWeight: 700,
                              border: foodPalette.length < 3 ? "1px solid #2c352f" : "none",
                              background: foodPalette.length < 3 ? "transparent" : "var(--green)",
                              color: foodPalette.length < 3 ? "#566158" : "#101810",
                              opacity: generatingPlan ? 0.6 : 1,
                            }}>{generatingPlan ? "..." : `${d} days`}</button>
                          ))}
                        </div>
                        {planError && <p style={{ color: "#ee9e78", fontSize: "11px", margin: "12px 0 0" }}>{planError}</p>}
                      </div>
                      <Plan meals={plannedMeals} weekStart={planWeekStart || weekStartKey()} onWeekChange={setPlanWeekStart} onSchedule={updatePlannedMealSchedule} onRemove={removePlannedMeal} onLog={logPlannedMeal} onReviewGrocery={openWeeklyGrocery} />
                    </>
                  )}
                  {planSubView === "palette" && (
                    <FoodPalette
                      palette={foodPalette.map(f => ({
                        id: f.id,
                        foodName: f.foodName,
                        fdcId: f.fdcId,
                        caloriesPer100g: f.caloriesPer100g,
                        proteinPer100g: f.proteinPer100g,
                        carbsPer100g: f.carbsPer100g,
                        fatPer100g: f.fatPer100g,
                        fibrePer100g: f.fibrePer100g,
                        category: f.category,
                        preferredSlots: f.preferredSlots,
                      }))}
                      onAdd={handleAddPaletteFood}
                      onUpdateSlots={handleUpdatePaletteSlots}
                      onDelete={handleDeletePaletteFood}
                    />
                  )}
                  {planSubView === "review" && generatedPlan && (
                    <PlanReview
                      plan={generatedPlan}
                      calorieGoal={target}
                      proteinGoal={macroTargets.protein}
                      carbsGoal={macroTargets.carbs}
                      fatGoal={macroTargets.fat}
                      foodPalette={foodPalette}
                      onAccept={(meals) => handleAcceptPlan(meals)}
                      onReject={handleRejectPlan}
                      onRegenerateMeal={handleRegenerateMeal}
                    />
                  )}
                </>
              )}
              {tab === "log" && <Log onPhoto={usePhoto} notify={notify} recentFoods={recentFoods} onManual={openManualFood} />}
              {tab === "grocery" && <Grocery items={groceryItems} ready={groceryReady} weekLabel={groceryWeekLabel} onToggle={toggleGroceryItem} onAddCustom={addCustomGroceryItem} onRemoveCustom={removeCustomGroceryItem} onOpenPlan={() => setTab("plan")} />}
              {tab === "progress" && <Progress range={range} setRange={setRange} history={mealHistory} target={target} proteinTarget={macroTargets.protein} weightLogs={weightLogs} weightUnit={profile?.weight_unit || "kg"} onLogWeight={() => setModal("weight")} />}
            </>}
        </div>

        <nav className="bottom-nav" aria-label="Main navigation">
          {navItems.map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); if (item.id !== "plan") setPlanSubView("week"); }}><span>{item.icon}</span><small>{item.label}</small></button>)}
        </nav>
      </section>

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
      {legacyImport && <div className="modal-backdrop"><section className="modal-sheet">
        <div className="modal-icon">↥</div>
        <p className="eyebrow">ONE-TIME IMPORT</p>
        <h2>Bring your earlier NutriPath data into this account?</h2>
        <p className="modal-sub">This browser contains {legacyMealCount} {legacyMealCount === 1 ? "meal or plan" : "meals or plans"} and {legacyImport.savedProducts.length} saved {legacyImport.savedProducts.length === 1 ? "product" : "products"}. Importing saves them under this signed-in account without duplicating existing records.</p>
        <div className="connection-notice"><b>Your account stays private</b><span>After import, this data is protected by your Supabase user ID and will not be shown to other NutriPath accounts.</span></div>
        <button className="primary full" disabled={importingLegacy} onClick={importLegacyData}>{importingLegacy ? "Importing securely…" : "Import to my account"}</button>
        <button className="text-button" disabled={importingLegacy} onClick={skipLegacyImport}>Keep this account separate</button>
      </section></div>}
      {modal && <Modal type={modal} close={() => setModal(null)} addWater={addWater} setWaterTotal={saveWaterTotal} saveWaterGoal={saveWaterGoal} water={water} waterGoal={waterGoal} waterDate={selectedDate || localDateKey()} next={setModal} notify={notify} setTab={setTab} onPhoto={usePhoto} uploadedPhoto={uploadedPhoto} uploadedData={uploadedData} analysis={analysis} analyzing={analyzing} analysisError={analysisError} onAnalyze={analyzePhoto} onAddAnalysis={addAnalyzedMeal} profile={profile} target={target} macroTargets={macroTargets} onLogout={logout} loggingOut={loggingOut} savedProducts={savedProducts} onSaveProducts={(products: SavedPackagedProduct[]) => { setSavedProducts(products); void saveProductState(products); }} onSaveProfileGoals={saveProfileGoals} onSaveProfileMacros={saveProfileMacros} weightLogs={weightLogs} onSaveWeight={saveWeightEntry} onDeleteWeight={deleteWeightEntry} manualStartMode={manualStartMode} manualInitialFood={manualInitialFood} recentFoods={recentFoods} onAddManualFood={addManualFood} />}
      <LegalFooter />
    </main>
  );
}

function Brand() {
  return <div className="brand"><div className="brandmark">N</div><div><strong>NutriPath</strong><small>Plan better. Track simply. Eat your way.</small></div></div>;
}

function profileInitials(name?: string | null) {
  const initials = String(name || "NutriPath")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("");
  return initials || "NP";
}

function profileGoalLabel(goal?: NutriPathProfile["primary_goal"]) {
  if (goal === "lose_weight") return "Lose weight";
  if (goal === "build_muscle") return "Build muscle";
  if (goal === "eat_healthier") return "Eat healthier";
  if (goal === "maintain_weight") return "Maintain weight";
  return "Nutrition goal";
}

function GoalsEditor({
  profile,
  onBack,
  onSave,
}: {
  profile: NutriPathProfile;
  onBack: () => void;
  onSave: (values: ProfileGoalUpdate) => Promise<string>;
}) {
  const initialImperialHeight = cmToImperial(profile.height_cm);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">(profile.weight_unit || "kg");
  const [weight, setWeight] = useState(profile.weight_kg
    ? String(profile.weight_unit === "lb" ? Math.round(profile.weight_kg * 2.20462 * 10) / 10 : profile.weight_kg)
    : "");
  const [heightUnit, setHeightUnit] = useState<"cm" | "imperial">(profile.height_unit || "cm");
  const [heightCm, setHeightCm] = useState(profile.height_cm ? String(profile.height_cm) : "");
  const [feet, setFeet] = useState(initialImperialHeight.feet);
  const [inches, setInches] = useState(initialImperialHeight.inches);
  const [goal, setGoal] = useState<Goal | "">(profile.primary_goal || "");
  const [activity, setActivity] = useState<Activity | "">(profile.activity_level || "");
  const [calorieGoal, setCalorieGoal] = useState(profile.calorie_goal ? String(profile.calorie_goal) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const normalizedWeight = useMemo(() => {
    const value = Number(weight);
    return weightUnit === "lb" ? value / 2.20462 : value;
  }, [weight, weightUnit]);

  const normalizedHeight = useMemo(() => {
    if (heightUnit === "cm") return Number(heightCm);
    return (Number(feet) * 12 + Number(inches)) * 2.54;
  }, [heightCm, heightUnit, feet, inches]);

  const suggested = useMemo(() => {
    if (
      !(normalizedWeight > 0)
      || !(normalizedHeight > 0)
      || !(Number(profile.age) >= 18)
      || !profile.calculation_sex
      || !activity
      || !goal
    ) return 0;
    return suggestedCalories(
      normalizedWeight,
      normalizedHeight,
      Number(profile.age),
      profile.calculation_sex,
      activity,
      goal,
    );
  }, [normalizedWeight, normalizedHeight, profile.age, profile.calculation_sex, activity, goal]);

  const validationError = useMemo(() => {
    if (!(normalizedWeight >= 30 && normalizedWeight <= 350)) return "Enter a weight between 30 and 350 kg (66 and 772 lb).";
    if (!(normalizedHeight >= 120 && normalizedHeight <= 230)) return "Enter a height between 120 and 230 cm.";
    if (!goal) return "Select your primary goal.";
    if (!activity) return "Select your activity level.";
    const target = Number(calorieGoal);
    if (!(target >= 1200 && target <= 6000)) return "Enter a daily calorie target between 1,200 and 6,000 kcal.";
    return "";
  }, [normalizedWeight, normalizedHeight, goal, activity, calorieGoal]);

  function changeWeightUnit(nextUnit: "kg" | "lb") {
    if (nextUnit === weightUnit) return;
    const current = Number(weight);
    if (current > 0) {
      const converted = nextUnit === "lb" ? current * 2.20462 : current / 2.20462;
      setWeight(String(Math.round(converted * 10) / 10));
    }
    setWeightUnit(nextUnit);
  }

  function changeHeightUnit(nextUnit: "cm" | "imperial") {
    if (nextUnit === heightUnit) return;
    if (nextUnit === "imperial") {
      const converted = cmToImperial(Number(heightCm) || null);
      setFeet(converted.feet);
      setInches(converted.inches);
    } else {
      const converted = (Number(feet) * 12 + Number(inches)) * 2.54;
      if (converted > 0) setHeightCm(String(Math.round(converted * 10) / 10));
    }
    setHeightUnit(nextUnit);
  }

  async function save() {
    if (validationError || !goal || !activity) {
      setError(validationError || "Complete every required field.");
      return;
    }
    setSaving(true);
    setError("");
    const saveError = await onSave({
      weight_kg: Math.round(normalizedWeight * 10) / 10,
      height_cm: Math.round(normalizedHeight * 10) / 10,
      weight_unit: weightUnit,
      height_unit: heightUnit,
      primary_goal: goal,
      activity_level: activity,
      suggested_calorie_goal: suggested || null,
      calorie_goal: Number(calorieGoal),
    });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onBack();
  }

  return <div className="goals-editor">
    <button className="goals-back" type="button" onClick={onBack}>‹ Profile</button>
    <p className="eyebrow">GOALS & TARGETS</p>
    <h2>Update your nutrition settings</h2>
    <p className="modal-sub">Changes are saved to your account and update the dashboard immediately.</p>

    <section className="goals-section">
      <div className="goals-section-title"><strong>Weight</strong><span>Used for your calorie estimate</span></div>
      <div className="goals-unit-row">
        <div className="goals-unit-toggle"><button type="button" className={weightUnit === "kg" ? "active" : ""} onClick={() => changeWeightUnit("kg")}>kg</button><button type="button" className={weightUnit === "lb" ? "active" : ""} onClick={() => changeWeightUnit("lb")}>lb</button></div>
        <label><span>Current weight</span><input type="number" inputMode="decimal" step="0.1" value={weight} onChange={event => setWeight(event.target.value)} /><small>{weightUnit}</small></label>
      </div>
    </section>

    <section className="goals-section">
      <div className="goals-section-title"><strong>Height and units</strong><span>Choose the system you normally use</span></div>
      <div className="goals-unit-toggle wide"><button type="button" className={heightUnit === "cm" ? "active" : ""} onClick={() => changeHeightUnit("cm")}>Metric</button><button type="button" className={heightUnit === "imperial" ? "active" : ""} onClick={() => changeHeightUnit("imperial")}>Imperial</button></div>
      {heightUnit === "cm"
        ? <label className="goals-field"><span>Height</span><input type="number" inputMode="decimal" value={heightCm} onChange={event => setHeightCm(event.target.value)} /><small>cm</small></label>
        : <div className="goals-height-row"><label><span>Feet</span><input type="number" inputMode="numeric" min="3" max="7" value={feet} onChange={event => setFeet(event.target.value)} /></label><label><span>Inches</span><input type="number" inputMode="numeric" min="0" max="11" value={inches} onChange={event => setInches(event.target.value)} /></label></div>}
    </section>

    <section className="goals-section">
      <div className="goals-section-title"><strong>Primary goal</strong><span>Adjusts the suggested target</span></div>
      <div className="goals-choice-grid">{(Object.keys(goalLabels) as Goal[]).map(value => <button type="button" key={value} className={goal === value ? "active" : ""} onClick={() => setGoal(value)}>{goalLabels[value]}</button>)}</div>
    </section>

    <section className="goals-section">
      <label className="goals-select"><span>Activity level</span><select value={activity} onChange={event => setActivity(event.target.value as Activity)}><option value="">Choose your activity level</option>{(Object.keys(activityLabels) as Activity[]).map(value => <option key={value} value={value}>{activityLabels[value]}</option>)}</select></label>
    </section>

    <section className="goals-section calorie-target-editor">
      <div className="goals-suggestion"><span>Updated estimate</span><strong>{suggested ? `${suggested.toLocaleString()} kcal` : "Complete your details"}</strong><small>Mifflin–St Jeor estimate using your stored age and calculation sex</small>{suggested > 0 && <button type="button" onClick={() => setCalorieGoal(String(suggested))}>Use suggested target</button>}</div>
      <label className="goals-field"><span>Your daily calorie goal</span><input type="number" inputMode="numeric" min="1200" max="6000" step="10" value={calorieGoal} onChange={event => setCalorieGoal(event.target.value)} /><small>kcal</small></label>
      <p className="goals-safety">This estimate is for general planning and is not medical advice. You can keep your own target instead of the suggestion.</p>
    </section>

    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="primary full" type="button" disabled={saving} onClick={save}>{saving ? "Saving changes…" : "Save goals and targets"}</button>
  </div>;
}

function MacroTargetsEditor({
  profile,
  calorieGoal,
  currentTargets,
  onBack,
  onSave,
}: {
  profile: NutriPathProfile;
  calorieGoal: number;
  currentTargets: MacroTargets;
  onBack: () => void;
  onSave: (values: ProfileMacroUpdate) => Promise<string>;
}) {
  const suggested = useMemo(
    () => suggestedMacroTargets(calorieGoal, profile.primary_goal),
    [calorieGoal, profile.primary_goal],
  );
  const [protein, setProtein] = useState(String(currentTargets.protein));
  const [carbs, setCarbs] = useState(String(currentTargets.carbs));
  const [fat, setFat] = useState(String(currentTargets.fat));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const targets = useMemo<MacroTargets>(() => {
    const values = [protein, carbs, fat].map(value => Number(value));
    return {
      protein: Number.isFinite(values[0]) ? values[0] : 0,
      carbs: Number.isFinite(values[1]) ? values[1] : 0,
      fat: Number.isFinite(values[2]) ? values[2] : 0,
    };
  }, [protein, carbs, fat]);
  const caloriesFromMacros = macroCalories(targets);
  const percentages = macroPercentages(targets);
  const calorieDifference = caloriesFromMacros - calorieGoal;
  const outsideGeneralRange = percentages.protein < 10
    || percentages.protein > 35
    || percentages.carbs < 45
    || percentages.carbs > 65
    || percentages.fat < 20
    || percentages.fat > 35;

  const validationError = useMemo(() => {
    if (!(targets.protein >= 20 && targets.protein <= 500)) return "Enter a protein target between 20 and 500 g.";
    if (!(targets.carbs >= 20 && targets.carbs <= 800)) return "Enter a carbohydrate target between 20 and 800 g.";
    if (!(targets.fat >= 10 && targets.fat <= 300)) return "Enter a fat target between 10 and 300 g.";
    return "";
  }, [targets]);

  function useSuggestion() {
    setProtein(String(suggested.protein));
    setCarbs(String(suggested.carbs));
    setFat(String(suggested.fat));
    setError("");
  }

  async function save() {
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    const usesCustomTargets = targets.protein !== suggested.protein
      || targets.carbs !== suggested.carbs
      || targets.fat !== suggested.fat;
    const saveError = await onSave({
      protein_goal_g: Math.round(targets.protein * 10) / 10,
      carbs_goal_g: Math.round(targets.carbs * 10) / 10,
      fat_goal_g: Math.round(targets.fat * 10) / 10,
      macro_targets_custom: usesCustomTargets,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onBack();
  }

  return <div className="goals-editor macro-targets-editor">
    <button className="goals-back" type="button" onClick={onBack}>‹ Profile</button>
    <p className="eyebrow">MACRO TARGETS</p>
    <h2>Set your daily macros</h2>
    <p className="modal-sub">NutriPath converts your {calorieGoal.toLocaleString()} kcal target into a general starting estimate. You can adjust each value.</p>

    <section className="goals-section macro-suggested-section">
      <div className="goals-section-title"><strong>Suggested starting point</strong><span>Based on your calorie target and {profileGoalLabel(profile.primary_goal).toLowerCase()} goal</span></div>
      <div className="macro-suggested-grid"><div><span>Protein</span><strong>{suggested.protein}g</strong></div><div><span>Carbs</span><strong>{suggested.carbs}g</strong></div><div><span>Fat</span><strong>{suggested.fat}g</strong></div></div>
      <button className="macro-use-suggestion" type="button" onClick={useSuggestion}>Use suggested targets</button>
    </section>

    <section className="goals-section macro-input-grid">
      <label><span>Protein</span><input type="number" inputMode="decimal" min="20" max="500" step="1" value={protein} onChange={event => setProtein(event.target.value)} /><small>g</small></label>
      <label><span>Carbohydrates</span><input type="number" inputMode="decimal" min="20" max="800" step="1" value={carbs} onChange={event => setCarbs(event.target.value)} /><small>g</small></label>
      <label><span>Fat</span><input type="number" inputMode="decimal" min="10" max="300" step="1" value={fat} onChange={event => setFat(event.target.value)} /><small>g</small></label>
    </section>

    <section className="macro-balance-card">
      <div><span>Calories represented by macros</span><strong>{caloriesFromMacros.toLocaleString()} kcal</strong></div>
      <small className={Math.abs(calorieDifference) <= 25 ? "balanced" : ""}>{calorieDifference === 0 ? "Matches your calorie goal" : `${Math.abs(calorieDifference).toLocaleString()} kcal ${calorieDifference > 0 ? "above" : "below"} your goal`}</small>
      <div className="macro-percent-row"><span>Protein {percentages.protein}%</span><span>Carbs {percentages.carbs}%</span><span>Fat {percentages.fat}%</span></div>
    </section>

    {outsideGeneralRange && <div className="connection-notice"><b>Custom distribution</b><span>One or more targets fall outside the general adult AMDR ranges. NutriPath will save your choice, but consider checking it with a qualified health professional.</span></div>}
    <p className="goals-safety">General adult reference ranges: protein 10–35%, carbohydrates 45–65%, and fat 20–35% of calories. Carbohydrate and protein use 4 kcal/g; fat uses 9 kcal/g. <a href="https://nap.nationalacademies.org/skim.php?chap=936-967&record_id=10490" target="_blank" rel="noreferrer">National Academies reference</a>.</p>

    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="primary full" type="button" disabled={saving} onClick={save}>{saving ? "Saving targets…" : "Save macro targets"}</button>
  </div>;
}

function Today({ meals, selectedDate, onSelectDate, consumed, protein, carbs, fat, target, macroTargets, pct, water, waterGoal, onMeal, onWater, onLog }: any) {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  const dates = today ? Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index - 6);
    return date;
  }) : [];
  const selectedLabel = selectedDate
    ? selectedDate === (today ? localDateKey(today) : "") ? "Today’s meals" : `${dateFromKey(selectedDate).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })} meals`
    : "Today’s meals";
  return <>
    <section className="daily-overview">
      <div className="today-date-strip">
        {dates.length === 0 && Array.from({ length: 7 }, (_, index) => <button key={index} disabled><span>--</span><strong>--</strong></button>)}
        {dates.map(date => {
          const dateKey = localDateKey(date);
          const active = dateKey === selectedDate;
          return <button type="button" key={dateKey} className={active ? "active" : ""} onClick={() => onSelectDate(dateKey)}><span>{date.toLocaleDateString([], { weekday: "short" }).slice(0, 2)}</span><strong>{date.getDate()}</strong>{active && <i />}</button>;
        })}
      </div>
      <div className="calorie-readout">
        <div><strong>{consumed.toLocaleString()}</strong><span>/ {target.toLocaleString()}</span></div>
        <small>CALORIES EATEN</small>
        <p>{Math.max(0, target - consumed).toLocaleString()} kcal left today</p>
        <i><b style={{ width: `${pct}%` }} /></i>
      </div>
      <div className="daily-macro-grid">
        <MacroGoal kind="carbs" label="Carbs" value={carbs} goal={macroTargets.carbs} />
        <MacroGoal kind="protein" label="Protein" value={protein} goal={macroTargets.protein} />
        <MacroGoal kind="fat" label="Fat" value={fat} goal={macroTargets.fat} />
      </div>
      <div className="overview-actions"><button className="scan-meal" onClick={onLog}><span>＋</span><b>Scan or log meal</b></button><button onClick={onWater} aria-label={`Water: ${water} of ${waterGoal} millilitres`}><span>♢</span><b>{(water / 1000).toFixed(1)} / {(waterGoal / 1000).toFixed(1)}L</b></button></div>
    </section>

    <section className="section-block">
      <div className="section-heading history-heading"><div><p className="eyebrow">MEAL HISTORY</p><h2>{selectedLabel}</h2></div><input className="history-date-picker" aria-label="Choose meal history date" type="date" value={selectedDate} max={today ? localDateKey(today) : undefined} onChange={event => { if (event.target.value) onSelectDate(event.target.value); }} /></div>
      {meals.length > 0
        ? <><span className="history-count">{meals.filter((m: Meal) => m.eaten).length} of {meals.length} complete</span><div className="meal-list">{meals.map((meal: Meal) => <MealCard key={meal.id} meal={meal} onMeal={onMeal} />)}</div></>
        : <div className="history-empty"><strong>No meals logged for this date.</strong><span>Select another day or log a meal for today.</span><button onClick={onLog}>Log today’s meal</button></div>}
    </section>

    <section className="insight-card"><div className="spark">✦</div><div><p className="eyebrow">TODAY’S INSIGHT</p><strong>You have {Math.max(0, Math.round(macroTargets.protein - protein))}g of protein remaining.</strong><p>Your planned meals can help close the gap.</p></div></section>
  </>;
}

function MacroGoal({ kind, label, value, goal }: { kind: string; label: string; value: number; goal: number }) {
  return <div className={`macro-goal ${kind}`}><span>{label}</span><i><b style={{ width: `${Math.min(100, Math.round(value / goal * 100))}%` }} /></i><strong>{value}<small> / {goal}g</small></strong></div>;
}

function MealCard({ meal, onMeal }: { meal: Meal; onMeal: (id: number) => void }) {
  return <article className={`meal-card ${meal.eaten ? "done" : ""}`}>
    <div className={`meal-image ${meal.color}`}><span>{meal.type === "Breakfast" ? "◒" : meal.type === "Lunch" ? "◐" : meal.type === "Dinner" ? "◑" : "●"}</span></div>
    <div className="meal-info"><div><span>{meal.type} · {meal.time}</span>{meal.locked && <em>Locked</em>}</div><h3>{meal.name}</h3><p>{meal.calories} kcal <b>·</b> {meal.protein}g protein</p></div>
    <button className={meal.eaten ? "check checked" : "check"} onClick={() => onMeal(meal.id)} aria-label={`Mark ${meal.name} ${meal.eaten ? "not eaten" : "eaten"}`}>{meal.eaten ? "✓" : ""}</button>
  </article>;
}

function PlannedMealCard({ meal, defaultDate, onSchedule, onRemove, onLog }: {
  meal: Meal;
  defaultDate: string;
  onSchedule: (id: number, plannedDate: string | null, mealSlot?: MealSlot) => Promise<string>;
  onRemove: (id: number) => Promise<void>;
  onLog: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(!meal.plannedDate || !meal.mealSlot);
  const [date, setDate] = useState(meal.plannedDate || defaultDate);
  const [slot, setSlot] = useState<MealSlot>(meal.mealSlot || "breakfast");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDate(meal.plannedDate || defaultDate);
    setSlot(meal.mealSlot || "breakfast");
  }, [meal.plannedDate, meal.mealSlot, defaultDate]);

  async function saveSchedule() {
    if (saving) return;
    setSaving(true);
    setError("");
    const saveError = await onSchedule(meal.id, date, slot);
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setEditing(false);
  }

  async function logToday() {
    if (saving) return;
    setSaving(true);
    await onLog(meal.id);
    setSaving(false);
  }

  return <article className="weekly-plan-meal">
    <div className="weekly-plan-meal-head"><div className={`meal-image ${meal.color}`}><span>{meal.mealSlot ? mealSlotLabels[meal.mealSlot].slice(0, 1) : "●"}</span></div><div><span>{meal.mealSlot ? mealSlotLabels[meal.mealSlot] : "Unscheduled"}</span><h3>{meal.name}</h3><p>{meal.calories} kcal · {meal.protein}g protein</p></div></div>
    {editing && <div className="plan-schedule-editor">
      <label><span>Date</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label><span>Meal</span><select value={slot} onChange={event => setSlot(event.target.value as MealSlot)}>{mealSlots.map(value => <option key={value} value={value}>{mealSlotLabels[value]}</option>)}</select></label>
      <button type="button" disabled={saving || !date} onClick={() => void saveSchedule()}>{saving ? "Saving…" : "Save schedule"}</button>
      {meal.plannedDate && <button className="plan-unschedule" type="button" disabled={saving} onClick={() => void onSchedule(meal.id, null)}>Move to Unscheduled</button>}
    </div>}
    {error && <div className="plan-card-error" role="alert">{error}</div>}
    <div className="weekly-plan-actions">
      <button type="button" onClick={() => setEditing(value => !value)}>{editing ? "Close editor" : "Move"}</button>
      <button type="button" disabled={saving} onClick={() => void logToday()}>Log as eaten today</button>
      <button className="remove" type="button" disabled={saving} onClick={() => { if (window.confirm(`Remove ${meal.name} from My Plan?`)) void onRemove(meal.id); }}>Remove</button>
    </div>
  </article>;
}

function Plan({ meals, weekStart, onWeekChange, onSchedule, onRemove, onLog, onReviewGrocery }: {
  meals: Meal[];
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
  onSchedule: (id: number, plannedDate: string | null, mealSlot?: MealSlot) => Promise<string>;
  onRemove: (id: number) => Promise<void>;
  onLog: (id: number) => Promise<void>;
  onReviewGrocery: (weekStart: string) => Promise<void>;
}) {
  const activeWeekStart = isDateKey(weekStart) ? weekStart : weekStartKey();
  const dates = weekDateKeys(activeWeekStart);
  const today = localDateKey();
  const [selectedPlanDate, setSelectedPlanDate] = useState(dates.includes(today) ? today : dates[0]);

  useEffect(() => {
    const nextDates = weekDateKeys(activeWeekStart);
    setSelectedPlanDate(nextDates.includes(today) ? today : nextDates[0]);
  }, [activeWeekStart, today]);

  const weekMeals = mealsForWeek(meals, activeWeekStart);
  const unscheduled = meals.filter(meal => !isDateKey(meal.plannedDate) || !normalizeMealSlot(meal.mealSlot));
  const selectedMeals = weekMeals.filter(meal => meal.plannedDate === selectedPlanDate);
  const plannedCalories = weekMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const weekEnd = dates[6];
  const weekLabel = `${dateFromKey(activeWeekStart).toLocaleDateString([], { day: "numeric", month: "short" })}–${dateFromKey(weekEnd).toLocaleDateString([], { day: "numeric", month: "short" })}`;

  function changeWeek(nextStart: string) {
    onWeekChange(nextStart);
    const nextDates = weekDateKeys(nextStart);
    setSelectedPlanDate(nextDates.includes(today) ? today : nextDates[0]);
  }

  return <>
    <section className="plan-summary weekly-plan-summary"><div><p className="eyebrow">WEEKLY MEAL PLAN</p><h2>{weekMeals.length} {weekMeals.length === 1 ? "meal" : "meals"} · {plannedCalories.toLocaleString()} kcal</h2><p>{weekLabel}. Planned calories remain separate from food already eaten.</p></div><span>{unscheduled.length} unscheduled</span></section>

    <div className="week-navigation"><button type="button" aria-label="Previous week" onClick={() => changeWeek(shiftDateKey(activeWeekStart, -7))}>‹</button><div><strong>{weekLabel}</strong><button type="button" onClick={() => changeWeek(weekStartKey(today))}>This week</button></div><button type="button" aria-label="Next week" onClick={() => changeWeek(shiftDateKey(activeWeekStart, 7))}>›</button></div>

    <div className="week-date-strip">{dates.map(date => {
      const count = weekMeals.filter(meal => meal.plannedDate === date).length;
      const active = date === selectedPlanDate;
      return <button type="button" key={date} className={active ? "active" : ""} onClick={() => setSelectedPlanDate(date)}><span>{dateFromKey(date).toLocaleDateString([], { weekday: "short" }).slice(0, 2)}</span><strong>{dateFromKey(date).getDate()}</strong><small>{count || ""}</small></button>;
    })}</div>

    <section className="weekly-day-plan"><div className="section-heading"><div><p className="eyebrow">SELECTED DAY</p><h2>{dateFromKey(selectedPlanDate).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</h2></div><span>{selectedMeals.reduce((sum, meal) => sum + meal.calories, 0).toLocaleString()} kcal</span></div>
      {mealSlots.map(slot => {
        const slotMeals = selectedMeals.filter(meal => meal.mealSlot === slot);
        return <div className="meal-slot" key={slot}><div className="meal-slot-heading"><strong>{mealSlotLabels[slot]}</strong><span>{slotMeals.length ? `${slotMeals.length} ${slotMeals.length === 1 ? "meal" : "meals"}` : "Empty"}</span></div>{slotMeals.length ? slotMeals.map(meal => <PlannedMealCard key={meal.id} meal={meal} defaultDate={selectedPlanDate} onSchedule={onSchedule} onRemove={onRemove} onLog={onLog} />) : <p>No {mealSlotLabels[slot].toLowerCase()} planned.</p>}</div>;
      })}
    </section>

    <section className="unscheduled-plan"><div className="section-heading"><div><p className="eyebrow">READY TO SCHEDULE</p><h2>Unscheduled meals</h2></div><span>{unscheduled.length}</span></div>{unscheduled.length ? <div className="weekly-unscheduled-list">{unscheduled.map(meal => <PlannedMealCard key={meal.id} meal={meal} defaultDate={selectedPlanDate} onSchedule={onSchedule} onRemove={onRemove} onLog={onLog} />)}</div> : <div className="history-empty"><strong>All planned meals are scheduled.</strong><span>Add another meal from Log Food when you are ready.</span></div>}</section>

    {meals.length === 0 && <div className="history-empty"><strong>No meals in your plan yet.</strong><span>Analyze or manually enter a meal, then select Add to plan.</span></div>}
    <button className="wide-button" onClick={() => void onReviewGrocery(activeWeekStart)}>Review this week’s grocery list <span>→</span></button>
  </>;
}

function PhotoPicker({ label, capture, onPhoto, secondary = false }: { label: string; capture?: "environment"; onPhoto: (file?: File) => void; secondary?: boolean }) {
  return <label className={`photo-picker ${secondary ? "secondary" : ""}`}>
    <input type="file" accept="image/*" capture={capture} onChange={event => onPhoto(event.target.files?.[0])} />
    <span>{capture ? "◎" : "▧"}</span>{label}
  </label>;
}

function Log({
  onPhoto,
  notify,
  recentFoods,
  onManual,
}: {
  onPhoto: (file?: File) => void;
  notify: (s: string) => void;
  recentFoods: ManualFoodItem[];
  onManual: (mode: "search" | "saved" | "custom", food?: ManualFoodItem | null) => void;
}) {
  return <>
    <section className="log-hero"><div className="camera-orb">◎<i>✦</i></div><h2>What did you eat?</h2><p>Snap a photo and NutriPath will estimate the meal—then ask when details could make it more accurate.</p><div className="photo-actions"><PhotoPicker label="Take a photo" capture="environment" onPhoto={onPhoto} /><PhotoPicker label="Upload from library" onPhoto={onPhoto} secondary /></div><span>Nutrition values are always estimates.</span></section>
    <section className="method-grid">
      <button onClick={() => onManual("search")}><i>⌕</i><div><strong>Search food</strong><span>Find USDA foods and calculate an exact gram amount</span></div><b>›</b></button>
      <button onClick={() => notify("Barcode scanning is planned for a later development step")}><i>▣</i><div><strong>Scan a barcode</strong><span>Coming after manual food search is verified</span></div><b>›</b></button>
      <button onClick={() => onManual("custom")}><i>✎</i><div><strong>Enter manually</strong><span>Enter a food name, grams, calories and macros</span></div><b>›</b></button>
    </section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">QUICK ADD</p><h2>Recent foods</h2></div>{recentFoods.length > 0 && <button onClick={() => onManual("saved")}>View all</button>}</div>
      {recentFoods.length
        ? <div className="recent-row">{recentFoods.slice(0, 4).map((food, index) => <button key={food.sourceKey} onClick={() => onManual("saved", food)}><span className={`mini-food ${index % 2 ? "berry" : "wrap"}`} />{food.name}<small>{Math.round(food.caloriesPer100g)} kcal per 100g</small></button>)}</div>
        : <div className="history-empty"><strong>No recent foods yet.</strong><span>Search or manually enter a food. After you log it, NutriPath will keep it here for faster reuse.</span><button onClick={() => onManual("search")}>Search food</button></div>}
    </section>
  </>;
}

function Grocery({
  items,
  ready,
  weekLabel,
  onToggle,
  onAddCustom,
  onRemoveCustom,
  onOpenPlan,
}: {
  items: GroceryItem[];
  ready: boolean;
  weekLabel: string;
  onToggle: (itemKey: string) => Promise<void>;
  onAddCustom: (values: { name: string; quantity: number; unit: GroceryUnit; category: GroceryCategory }) => Promise<string>;
  onRemoveCustom: (itemKey: string) => Promise<void>;
  onOpenPlan: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [hideChecked, setHideChecked] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customQuantity, setCustomQuantity] = useState("1");
  const [customUnit, setCustomUnit] = useState<GroceryUnit>("item");
  const [customCategory, setCustomCategory] = useState<GroceryCategory>("Other");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const checkedCount = items.filter(item => item.checked).length;
  const percent = items.length ? Math.round(checkedCount / items.length * 100) : 0;
  const visibleItems = hideChecked ? items.filter(item => !item.checked) : items;
  const categoryOrder: GroceryCategory[] = ["Produce", "Meat & seafood", "Dairy & eggs", "Pantry", "Other"];
  const groups = categoryOrder
    .map(category => ({ category, items: visibleItems.filter(item => item.category === category) }))
    .filter(group => group.items.length);

  async function submitCustomItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const saveError = await onAddCustom({
      name: customName,
      quantity: Number(customQuantity),
      unit: customUnit,
      category: customCategory,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setCustomName("");
    setCustomQuantity("1");
    setCustomUnit("item");
    setCustomCategory("Other");
    setShowAdd(false);
  }

  if (!ready) {
    return <div className="history-empty"><strong>Building your grocery list…</strong><span>NutriPath is combining ingredients from My Plan and restoring your saved checkmarks.</span></div>;
  }

  return <>
    <section className="grocery-head"><div className="grocery-icon">✓</div><div><p className="eyebrow">FROM MY PLAN · {weekLabel.toUpperCase()}</p><h2>{items.length} {items.length === 1 ? "item" : "items"} on your list</h2><p>{checkedCount} checked · Repeated planned ingredients are combined.</p></div></section>
    <div className="grocery-progress"><i><b style={{ width: `${percent}%` }} /></i><span>{percent}%</span></div>

    <div className="grocery-toolbar">
      <button type="button" className={showAdd ? "active" : ""} onClick={() => { setShowAdd(value => !value); setError(""); }}>＋ Add item</button>
      <button type="button" disabled={!checkedCount} onClick={() => setHideChecked(value => !value)}>{hideChecked ? "Show checked" : "Hide checked"}</button>
    </div>

    {showAdd && <form className="grocery-add-form" onSubmit={submitCustomItem}>
      <label className="grocery-name"><span>Item</span><input value={customName} onChange={event => setCustomName(event.target.value)} placeholder="Example: Sparkling water" maxLength={160} /></label>
      <label><span>Quantity</span><input type="number" inputMode="decimal" min="0.1" max="100000" step="0.1" value={customQuantity} onChange={event => setCustomQuantity(event.target.value)} /></label>
      <label><span>Unit</span><select value={customUnit} onChange={event => setCustomUnit(event.target.value as GroceryUnit)}><option value="item">item</option><option value="g">g</option></select></label>
      <label><span>Category</span><select value={customCategory} onChange={event => setCustomCategory(event.target.value as GroceryCategory)}>{categoryOrder.map(category => <option key={category}>{category}</option>)}</select></label>
      {error && <div className="auth-error">{error}</div>}
      <button className="primary full" type="submit" disabled={saving}>{saving ? "Saving…" : "Save grocery item"}</button>
    </form>}

    {groups.map(group => <section className="grocery-group" key={group.category}>
      <div><h3>{group.category}</h3><span>{group.items.filter(item => item.checked).length}/{group.items.length}</span></div>
      {group.items.map(item => <div className={`grocery-row ${item.checked ? "checked" : ""}`} key={item.itemKey}>
        <label>
          <input type="checkbox" checked={item.checked} onChange={() => void onToggle(item.itemKey)} />
          <i>{item.checked ? "✓" : ""}</i>
          <span><strong>{item.name}</strong><small>{groceryQuantityLabel(item)}{item.sourceType === "planned" ? " · from My Plan" : " · custom item"}</small></span>
        </label>
        {item.sourceType === "custom" && <button type="button" className="grocery-remove" onClick={() => void onRemoveCustom(item.itemKey)}>Remove</button>}
      </div>)}
    </section>)}

    {!items.length && <div className="history-empty"><strong>Your grocery list is empty.</strong><span>Add meals to My Plan and their confirmed ingredients will appear here. You can also add a custom grocery item.</span><button onClick={onOpenPlan}>Open My Plan</button></div>}
    {items.length > 0 && visibleItems.length === 0 && <div className="history-empty"><strong>Everything is checked.</strong><span>Show checked items whenever you want to review the complete list.</span><button onClick={() => setHideChecked(false)}>Show checked items</button></div>}
    <p className="grocery-note">Quantities are the combined food weights saved in My Plan. Package purchase sizes and cooked-to-raw weights can differ.</p>
  </>;
}

function groceryQuantityLabel(item: GroceryItem) {
  const quantity = Number.isInteger(item.quantity) ? item.quantity.toLocaleString() : item.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (item.unit === "g") return `${quantity} g planned`;
  if (item.unit === "meal") return `${quantity} ${item.quantity === 1 ? "meal" : "meals"}`;
  return `${quantity} ${item.quantity === 1 ? "item" : "items"}`;
}

function Progress({
  range,
  setRange,
  history,
  target,
  proteinTarget,
  weightLogs,
  weightUnit,
  onLogWeight,
}: {
  range: string;
  setRange: (s: string) => void;
  history: MealHistory;
  target: number;
  proteinTarget: number;
  weightLogs: WeightLog[];
  weightUnit: "kg" | "lb";
  onLogWeight: () => void;
}) {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  const rangeDays = range === "Week" ? 7 : range === "Month" ? 30 : 90;
  const periodDates = today ? Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (rangeDays - 1 - index));
    return localDateKey(date);
  }) : [];
  const periodTotals = periodDates.map(date => ({ date, ...mealTotals(history[date] || []) }));
  const trackedDays = periodTotals.filter(day => day.count > 0);
  const totalCalories = trackedDays.reduce((sum, day) => sum + day.calories, 0);
  const averageCalories = trackedDays.length ? Math.round(totalCalories / trackedDays.length) : 0;
  const proteinTargetDays = trackedDays.filter(day => day.protein >= proteinTarget).length;
  const loggedMeals = trackedDays.reduce((sum, day) => sum + day.count, 0);
  const chartDays = periodTotals.slice(-7).map(day => ({
    key: day.date,
    day: dateFromKey(day.date).toLocaleDateString([], { weekday: "short" }),
    value: day.calories,
  }));
  const firstPeriodDate = periodDates[0] || "";
  const lastPeriodDate = periodDates[periodDates.length - 1] || "";
  const periodWeightLogs = weightLogs
    .filter(log => log.logged_on >= firstPeriodDate && log.logged_on <= lastPeriodDate)
    .sort((a, b) => a.logged_on.localeCompare(b.logged_on));
  const displayWeights = periodWeightLogs.map(log => weightInUnit(log.weight_kg, weightUnit));
  const firstWeight = displayWeights[0];
  const latestWeight = displayWeights[displayWeights.length - 1];
  const weightChange = displayWeights.length > 1 ? Math.round((latestWeight - firstWeight) * 10) / 10 : 0;
  const weightTrend = displayWeights.length < 2
    ? "Add another measurement to see a trend"
    : weightChange === 0
      ? `No change in this ${range.toLowerCase()} view`
      : `${Math.abs(weightChange).toFixed(1)} ${weightUnit} ${weightChange < 0 ? "down" : "up"}`;
  const chartMin = displayWeights.length ? Math.min(...displayWeights) : 0;
  const chartMax = displayWeights.length ? Math.max(...displayWeights) : 0;
  const chartSpread = Math.max(0.5, chartMax - chartMin);
  const weightPoints = displayWeights.map((value, index) => {
    const x = displayWeights.length === 1 ? 150 : 12 + (index / (displayWeights.length - 1)) * 276;
    const y = 100 - ((value - chartMin) / chartSpread) * 78;
    return { x, y, value, log: periodWeightLogs[index] };
  });
  return <>
    <div className="segment">{["Week", "Month", "3 months"].map(x => <button key={x} className={range === x ? "active" : ""} onClick={() => setRange(x)}>{x}</button>)}</div>
    <section className="weekly-win"><div className="spark">✦</div><div><p className="eyebrow">MEAL HISTORY</p><h2>{trackedDays.length ? `${trackedDays.length} ${trackedDays.length === 1 ? "day" : "days"} tracked.` : "Your history starts here."}</h2><p>{trackedDays.length ? `${loggedMeals} meals are saved in this ${range.toLowerCase()} view.` : "Log your first meal and NutriPath will build your calorie and macro history."}</p></div></section>
    <section className="stats-grid"><div><span>Days logged</span><strong>{trackedDays.length}</strong><small>of {rangeDays} days</small></div><div><span>Avg. calories</span><strong>{averageCalories.toLocaleString()}</strong><small>{averageCalories ? `${Math.abs(target - averageCalories).toLocaleString()} ${averageCalories <= target ? "below" : "above"} target` : "No entries yet"}</small></div><div><span>Protein target</span><strong>{proteinTargetDays}/{trackedDays.length || 0}</strong><small>tracked days reached</small></div><div><span>Meals logged</span><strong>{loggedMeals}</strong><small>confirmed as eaten</small></div></section>
    <section className="chart-card"><div className="section-heading"><div><p className="eyebrow">LAST 7 DAYS</p><h2>Calories by day</h2></div><span>{target.toLocaleString()} goal</span></div><div className="chart"><div className="goal-line"><span>Goal</span></div>{chartDays.map(day => <div className="bar-wrap" key={day.key}><div className={day.key === (today ? localDateKey(today) : "") ? "bar active" : "bar"} style={{ height: `${Math.max(8, Math.min(110, day.value / 20))}px` }}><span>{day.value || "–"}</span></div><small>{day.day}</small></div>)}</div></section>
    <section className="weight-progress-card">
      <div className="weight-progress-head">
        <div><p className="eyebrow">WEIGHT PROGRESS</p><h2>{periodWeightLogs.length ? `${latestWeight.toFixed(1)} ${weightUnit}` : "No weight logged"}</h2><span>{weightTrend}</span></div>
        <button type="button" onClick={onLogWeight}>＋ Log weight</button>
      </div>
      {weightPoints.length
        ? <>
          <div className="weight-chart" role="img" aria-label={`Weight trend with ${weightPoints.length} measurements`}>
            <svg viewBox="0 0 300 120" preserveAspectRatio="none">
              <line x1="12" y1="100" x2="288" y2="100" className="weight-chart-axis" />
              {weightPoints.length > 1 && <polyline points={weightPoints.map(point => `${point.x},${point.y}`).join(" ")} className="weight-chart-line" />}
              {weightPoints.map(point => <g key={point.log.id}><circle cx={point.x} cy={point.y} r="5" className="weight-chart-point" /><text x={point.x} y={Math.max(12, point.y - 10)} textAnchor="middle">{point.value.toFixed(1)}</text></g>)}
            </svg>
          </div>
          <div className="weight-chart-dates"><span>{dateFromKey(periodWeightLogs[0].logged_on).toLocaleDateString([], { day: "numeric", month: "short" })}</span><span>{dateFromKey(periodWeightLogs[periodWeightLogs.length - 1].logged_on).toLocaleDateString([], { day: "numeric", month: "short" })}</span></div>
        </>
        : <div className="weight-empty"><span>Log a measurement to start your private weight history.</span><small>NutriPath stores it under your signed-in account.</small></div>}
    </section>
  </>;
}

function WeightProgressEditor({
  profile,
  logs,
  onBack,
  onReviewGoals,
  onSave,
  onDelete,
}: {
  profile: NutriPathProfile;
  logs: WeightLog[];
  onBack: () => void;
  onReviewGoals: () => void;
  onSave: (loggedOn: string, weightKg: number) => Promise<WeightSaveResult>;
  onDelete: (logId: string) => Promise<string>;
}) {
  const unit = profile.weight_unit || "kg";
  const today = localDateKey();
  const latestLog = [...logs].sort((a, b) => b.logged_on.localeCompare(a.logged_on))[0];
  const startingWeightKg = latestLog?.weight_kg || Number(profile.weight_kg || 0);
  const [loggedOn, setLoggedOn] = useState(today);
  const [weight, setWeight] = useState(startingWeightKg ? String(weightInUnit(startingWeightKg, unit)) : "");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [profileUpdated, setProfileUpdated] = useState(false);

  function selectDate(nextDate: string) {
    setLoggedOn(nextDate);
    const existing = logs.find(log => log.logged_on === nextDate);
    setWeight(existing ? String(weightInUnit(existing.weight_kg, unit)) : "");
    setSaved(false);
    setError("");
  }

  async function submitWeight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaved(false);

    const enteredWeight = Number(weight);
    const weightKg = weightToKg(enteredWeight, unit);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(loggedOn) || loggedOn > today) {
      setError("Choose today or an earlier date.");
      return;
    }
    if (!Number.isFinite(enteredWeight) || weightKg < 30 || weightKg > 350) {
      setError(`Enter a weight between ${unit === "lb" ? "66 and 772 lb" : "30 and 350 kg"}.`);
      return;
    }

    setSaving(true);
    const result = await onSave(loggedOn, weightKg);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setProfileUpdated(result.profileUpdated);
    setSaved(true);
  }

  async function deleteEntry(log: WeightLog) {
    if (deletingId || !window.confirm(`Remove the weight recorded on ${dateFromKey(log.logged_on).toLocaleDateString()}?`)) return;
    setDeletingId(log.id);
    setError("");
    const deleteError = await onDelete(log.id);
    setDeletingId("");
    if (deleteError) {
      setError(deleteError);
      return;
    }
    if (log.logged_on === loggedOn) setWeight("");
    setSaved(false);
  }

  const recentLogs = [...logs].sort((a, b) => b.logged_on.localeCompare(a.logged_on)).slice(0, 8);
  return <div className="weight-editor">
    <button className="goals-back" type="button" onClick={onBack}>‹ Profile</button>
    <p className="eyebrow">WEIGHT PROGRESS</p>
    <h2>Log your weight</h2>
    <p className="modal-sub">NutriPath uses your preferred {unit} display and securely stores the underlying measurement in kilograms.</p>

    <form className="weight-entry-form" onSubmit={submitWeight}>
      <label><span>Date</span><input type="date" value={loggedOn} max={today} onChange={event => selectDate(event.target.value)} /></label>
      <label><span>Weight</span><input type="number" inputMode="decimal" min={unit === "lb" ? "66" : "30"} max={unit === "lb" ? "772" : "350"} step="0.1" value={weight} onChange={event => { setWeight(event.target.value); setSaved(false); }} /><small>{unit}</small></label>
      <button className="primary full" type="submit" disabled={saving}>{saving ? "Saving weight…" : logs.some(log => log.logged_on === loggedOn) ? "Update weight" : "Save weight"}</button>
    </form>

    {error && <div className="auth-error">{error}</div>}
    {saved && <div className="weight-saved">
      <strong>Weight saved</strong>
      <span>{profileUpdated ? "Your profile now uses this as your current weight." : "This measurement was added to your history. Your latest profile weight remains unchanged."}</span>
      <b>Your calorie and macro targets were not changed.</b>
      <div><button type="button" onClick={onBack}>Keep current targets</button><button type="button" onClick={onReviewGoals}>Review goals</button></div>
    </div>}

    <section className="weight-history-list">
      <div className="goals-section-title"><strong>Recent measurements</strong><span>One measurement is saved per date</span></div>
      {recentLogs.length
        ? recentLogs.map(log => <div key={log.id}><span>{dateFromKey(log.logged_on).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span><strong>{weightInUnit(log.weight_kg, unit).toFixed(1)} {unit}</strong><button type="button" disabled={deletingId === log.id} onClick={() => deleteEntry(log)}>{deletingId === log.id ? "Removing…" : "Remove"}</button></div>)
        : <p>No measurements saved yet.</p>}
    </section>
    <p className="goals-safety">Weight changes can affect suggested targets. NutriPath always asks before you review or change calorie and macro targets.</p>
  </div>;
}

function ManualFoodEditor({
  startMode,
  initialFood,
  recentFoods,
  savedProducts,
  onAdd,
}: {
  startMode: "search" | "saved" | "custom";
  initialFood: ManualFoodItem | null;
  recentFoods: ManualFoodItem[];
  savedProducts: SavedPackagedProduct[];
  onAdd: (food: ManualFoodItem, grams: number, destination: "today" | "plan") => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"search" | "saved" | "custom">(startMode);
  const [selectedFood, setSelectedFood] = useState<ManualFoodItem | null>(initialFood);
  const [grams, setGrams] = useState(initialFood ? String(initialFood.lastGrams || 100) : "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ManualFoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [customName, setCustomName] = useState("");
  const [customGrams, setCustomGrams] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [customFibre, setCustomFibre] = useState("");

  const savedFoods = useMemo(() => {
    const combined = [
      ...recentFoods,
      ...savedProducts.map(product => packagedProductFood(product)),
    ];
    const unique = new Map<string, ManualFoodItem>();
    combined.forEach(food => {
      if (!unique.has(food.sourceKey)) unique.set(food.sourceKey, food);
    });
    return Array.from(unique.values());
  }, [recentFoods, savedProducts]);

  const gramNumber = Number(grams);
  const validGrams = Number.isFinite(gramNumber) && gramNumber >= 1 && gramNumber <= 5000;
  const preview = selectedFood && validGrams
    ? calculateManualNutrition(selectedFood, gramNumber)
    : null;

  function chooseFood(food: ManualFoodItem) {
    setSelectedFood(food);
    setGrams(String(food.lastGrams || 100));
    setError("");
  }

  async function searchFoods(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.replace(/\s+/g, " ").trim();
    if (cleanQuery.length < 2) {
      setError("Enter at least two characters.");
      return;
    }
    setSearching(true);
    setError("");
    setResults([]);
    try {
      const response = await fetch("/api/food-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cleanQuery }),
      });
      const payload = await response.json() as { foods?: ManualFoodItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Food search failed.");
      setResults(Array.isArray(payload.foods) ? payload.foods : []);
      if (!payload.foods?.length) setError("No USDA foods matched that search. Try a simpler food name or use Custom.");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Food search failed.");
    } finally {
      setSearching(false);
    }
  }

  function reviewCustomFood(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const enteredGrams = Number(customGrams);
    const totals = {
      calories: Number(customCalories),
      protein: Number(customProtein || 0),
      carbs: Number(customCarbs || 0),
      fat: Number(customFat || 0),
      fibre: Number(customFibre || 0),
    };
    if (!customName.trim()) {
      setError("Enter a food name.");
      return;
    }
    if (!Number.isFinite(enteredGrams) || enteredGrams < 1 || enteredGrams > 5000) {
      setError("Enter a food weight between 1 and 5,000 grams.");
      return;
    }
    if (!Number.isFinite(totals.calories) || totals.calories <= 0 || totals.calories > enteredGrams * 10) {
      setError("Enter valid calories for this gram amount.");
      return;
    }
    if (Object.values(totals).some(value => !Number.isFinite(value) || value < 0)) {
      setError("Nutrition values cannot be negative.");
      return;
    }
    if ([totals.protein, totals.carbs, totals.fat, totals.fibre].some(value => value > enteredGrams)) {
      setError("Protein, carbs, fat and fibre cannot individually exceed the food’s total gram weight.");
      return;
    }

    const ratio = 100 / enteredGrams;
    const baseFood = {
      sourceType: "custom" as const,
      name: customName.trim().slice(0, 160),
      caloriesPer100g: totals.calories * ratio,
      proteinPer100g: totals.protein * ratio,
      carbsPer100g: totals.carbs * ratio,
      fatPer100g: totals.fat * ratio,
      fibrePer100g: totals.fibre * ratio,
      nutritionSource: `Manual entry · ${customName.trim().slice(0, 160)}`,
    };
    setSelectedFood({ ...baseFood, sourceKey: customFoodKey(baseFood) });
    setGrams(String(enteredGrams));
  }

  async function addFood(destination: "today" | "plan") {
    if (!selectedFood || !preview || adding) return;
    setAdding(true);
    setError("");
    const saved = await onAdd(selectedFood, preview.grams, destination);
    if (!saved) {
      setError("NutriPath could not complete this entry. Check the message above and try again.");
      setAdding(false);
    }
  }

  if (selectedFood) {
    return <div className="manual-food-editor">
      <button className="goals-back" type="button" onClick={() => { setSelectedFood(null); setError(""); }}>‹ Change food</button>
      <p className="eyebrow">MANUAL FOOD LOG</p>
      <h2>{selectedFood.name}</h2>
      {selectedFood.brandName && <p className="manual-brand">{selectedFood.brandName}</p>}
      <div className="manual-source"><strong>{selectedFood.sourceType === "usda" ? "USDA database" : selectedFood.sourceType === "nutrition_label" ? "Package nutrition label" : "Custom nutrition"}</strong><span>{selectedFood.nutritionSource}{selectedFood.fdcId ? ` · FDC ID ${selectedFood.fdcId}` : ""}</span></div>
      <label className="manual-grams"><span>Exact amount eaten</span><input type="number" inputMode="decimal" min="1" max="5000" step="0.1" value={grams} onChange={event => setGrams(event.target.value)} /><small>g</small></label>
      {preview
        ? <div className="manual-preview">
          <div className="manual-calories"><span>Calculated total</span><strong>{preview.calories}<small> kcal</small></strong></div>
          <div><span>Carbs</span><strong>{preview.carbs}g</strong></div>
          <div><span>Protein</span><strong>{preview.protein}g</strong></div>
          <div><span>Fat</span><strong>{preview.fat}g</strong></div>
          <div><span>Fibre</span><strong>{preview.fibre}g</strong></div>
        </div>
        : <div className="auth-error">Enter a gram amount between 1 and 5,000.</div>}
      {error && <div className="auth-error">{error}</div>}
      <div className="manual-add-actions"><button type="button" disabled={!preview || adding} onClick={() => addFood("today")}>{adding ? "Saving…" : "Add to Today"}</button><button type="button" disabled={!preview || adding} onClick={() => addFood("plan")}>Add to My Plan</button></div>
      <p className="goals-safety">Values are calculated from the selected per-100g source and the exact gram amount entered. Verify the selected food and preparation.</p>
    </div>;
  }

  return <div className="manual-food-editor">
    <p className="eyebrow">MANUAL FOOD LOG</p>
    <h2>Choose a food</h2>
    <p className="modal-sub">Search verified USDA records, reuse a saved food, or enter nutrition yourself.</p>
    <div className="segment manual-tabs">{[
      ["search", "Search USDA"],
      ["saved", "Saved"],
      ["custom", "Custom"],
    ].map(([value, label]) => <button type="button" key={value} className={mode === value ? "active" : ""} onClick={() => { setMode(value as "search" | "saved" | "custom"); setError(""); }}>{label}</button>)}</div>

    {mode === "search" && <>
      <form className="manual-search" onSubmit={searchFoods}><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Example: cooked brown rice" maxLength={80} /><button type="submit" disabled={searching}>{searching ? "Searching…" : "Search"}</button></form>
      <div className="manual-result-list">{results.map(food => <button type="button" key={food.sourceKey} onClick={() => chooseFood(food)}><span><strong>{food.name}</strong>{food.brandName && <small>{food.brandName}</small>}<em>{food.fdcId ? `USDA FDC ID ${food.fdcId}` : "USDA FoodData Central"}</em></span><b>{Math.round(food.caloriesPer100g)} kcal<small>per 100g</small></b></button>)}</div>
    </>}

    {mode === "saved" && <div className="manual-result-list">{savedFoods.length
      ? savedFoods.map(food => <button type="button" key={food.sourceKey} onClick={() => chooseFood(food)}><span><strong>{food.name}</strong><small>{food.sourceType === "nutrition_label" ? "Package nutrition label" : food.sourceType === "usda" ? "USDA FoodData Central" : "Custom entry"}</small>{food.timesUsed ? <em>Used {food.timesUsed} {food.timesUsed === 1 ? "time" : "times"}</em> : null}</span><b>{Math.round(food.caloriesPer100g)} kcal<small>per 100g</small></b></button>)
      : <div className="history-empty"><strong>No saved foods yet.</strong><span>Foods appear here after you log them or save a package nutrition label.</span></div>}</div>}

    {mode === "custom" && <form className="manual-custom-form" onSubmit={reviewCustomFood}>
      <label className="manual-custom-name"><span>Food name</span><input value={customName} onChange={event => setCustomName(event.target.value)} maxLength={160} placeholder="Example: Homemade protein bar" /></label>
      <label><span>Amount</span><input type="number" inputMode="decimal" min="1" max="5000" step="0.1" value={customGrams} onChange={event => setCustomGrams(event.target.value)} /><small>g</small></label>
      <label><span>Calories</span><input type="number" inputMode="decimal" min="1" step="1" value={customCalories} onChange={event => setCustomCalories(event.target.value)} /><small>kcal</small></label>
      <label><span>Carbs</span><input type="number" inputMode="decimal" min="0" step="0.1" value={customCarbs} onChange={event => setCustomCarbs(event.target.value)} /><small>g</small></label>
      <label><span>Protein</span><input type="number" inputMode="decimal" min="0" step="0.1" value={customProtein} onChange={event => setCustomProtein(event.target.value)} /><small>g</small></label>
      <label><span>Fat</span><input type="number" inputMode="decimal" min="0" step="0.1" value={customFat} onChange={event => setCustomFat(event.target.value)} /><small>g</small></label>
      <label><span>Fibre</span><input type="number" inputMode="decimal" min="0" step="0.1" value={customFibre} onChange={event => setCustomFibre(event.target.value)} /><small>g</small></label>
      <button className="primary full" type="submit">Review nutrition</button>
    </form>}
    {error && <div className="auth-error">{error}</div>}
  </div>;
}

function WaterEditor({ water, goal, date, onAdd, onSetTotal, onSaveGoal }: {
  water: number;
  goal: number;
  date: string;
  onAdd: (amountMl: number) => Promise<string>;
  onSetTotal: (amountMl: number) => Promise<string>;
  onSaveGoal: (goalMl: number) => Promise<string>;
}) {
  const [customAmount, setCustomAmount] = useState("");
  const [correctedTotal, setCorrectedTotal] = useState(String(water));
  const [goalAmount, setGoalAmount] = useState(String(goal));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setCorrectedTotal(String(water)), [water]);
  useEffect(() => setGoalAmount(String(goal)), [goal]);

  async function run(action: () => Promise<string>, afterSave?: () => void) {
    if (saving) return;
    setSaving(true);
    setError("");
    const saveError = await action();
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    afterSave?.();
  }

  const selectedDateLabel = date === localDateKey()
    ? "today"
    : dateFromKey(date).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  const progress = goal > 0 ? Math.min(100, Math.round((water / goal) * 100)) : 0;

  return <div className="water-editor">
    <div className="modal-icon">♢</div>
    <p className="eyebrow">WATER</p>
    <h2>Water for {selectedDateLabel}</h2>
    <p className="modal-sub">Your water is saved to this date and restored when you refresh or sign in again.</p>

    <div className="water-status">
      <div><strong>{water.toLocaleString()}</strong><span>/ {goal.toLocaleString()} ml</span></div>
      <small>{progress}% of your daily goal</small>
      <i><b style={{ width: `${progress}%` }} /></i>
    </div>

    <div className="water-options" aria-label="Quick add water">
      {[250, 500, 750].map(amount => <button type="button" key={amount} disabled={saving} onClick={() => void run(() => onAdd(amount))}><strong>{amount}</strong><span>ml · Add</span></button>)}
    </div>

    <section className="water-edit-section">
      <div className="goals-section-title"><strong>Add another amount</strong><span>Enter the amount you just drank</span></div>
      <div className="water-input-action"><label><span>Amount</span><input type="number" inputMode="numeric" min="1" max={MAX_DAILY_WATER_ML} step="1" value={customAmount} onChange={event => setCustomAmount(event.target.value)} /><small>ml</small></label><button type="button" disabled={saving || !customAmount} onClick={() => void run(() => onAdd(Number(customAmount)), () => setCustomAmount(""))}>Add</button></div>
    </section>

    <section className="water-edit-section">
      <div className="goals-section-title"><strong>Correct this date’s total</strong><span>Use this if an earlier entry was wrong</span></div>
      <div className="water-input-action"><label><span>Exact total</span><input type="number" inputMode="numeric" min="0" max={MAX_DAILY_WATER_ML} step="1" value={correctedTotal} onChange={event => setCorrectedTotal(event.target.value)} /><small>ml</small></label><button type="button" disabled={saving || correctedTotal === ""} onClick={() => void run(() => onSetTotal(Number(correctedTotal)))}>Save total</button></div>
    </section>

    <section className="water-edit-section">
      <div className="goals-section-title"><strong>Daily water goal</strong><span>This target applies to every date</span></div>
      <div className="water-input-action"><label><span>Goal</span><input type="number" inputMode="numeric" min={MIN_WATER_GOAL_ML} max={MAX_WATER_GOAL_ML} step="50" value={goalAmount} onChange={event => setGoalAmount(event.target.value)} /><small>ml</small></label><button type="button" disabled={saving || goalAmount === ""} onClick={() => void run(() => onSaveGoal(Number(goalAmount)))}>Save goal</button></div>
    </section>

    {error && <div className="auth-error" role="alert">{error}</div>}
    <p className="goals-safety">Water needs vary. This is a personal tracking target, not a medical recommendation. If you have been given a fluid limit, follow your qualified health professional’s advice.</p>
  </div>;
}

function Modal({ type, close, addWater, setWaterTotal, saveWaterGoal, water, waterGoal, waterDate, next, notify, setTab, onPhoto, uploadedPhoto, uploadedData, analysis, analyzing, analysisError, onAnalyze, onAddAnalysis, profile, target, macroTargets, onLogout, loggingOut, savedProducts, onSaveProducts, onSaveProfileGoals, onSaveProfileMacros, weightLogs, onSaveWeight, onDeleteWeight, manualStartMode, manualInitialFood, recentFoods, onAddManualFood }: any) {
  const [answers, setAnswers] = useState<string[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewIngredient[]>([]);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [fixingResult, setFixingResult] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmedUpdate, setConfirmedUpdate] = useState(false);
  const confirmedReviewRef = useRef<ReviewIngredient[] | null>(null);

  useEffect(() => {
    if (type !== "result" || !analysis) return;
    const confirmed = confirmedReviewRef.current;
    if (confirmed) {
      saveLabelProfiles(confirmed);
      setReviewItems(confirmed.map((ingredient, index) => {
        const recalculated = analysis.ingredients[index] || ingredient;
        return {
          ...recalculated,
          name: ingredient.name,
          amountGrams: ingredient.amountGrams,
        };
      }));
      confirmedReviewRef.current = null;
      setConfirmedUpdate(true);
    } else {
      setReviewItems(analysis.ingredients.map((item: ReviewIngredient) => ({ ...item })));
      setConfirmedUpdate(false);
    }
    setReviewDirty(false);
    setFixingResult(false);
    setEditingIndex(null);
  }, [type, analysis]);

  function saveLabelProfiles(ingredients: ReviewIngredient[]) {
    const labels = ingredients.filter(item => item.labelNutrition && labelIsComplete(item)).map(item => {
      const label = item.labelNutrition!;
      return {
        id: label.productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `product-${Date.now()}`,
        productName: label.productName.trim(),
        energyValue: Number(label.energyValue), energyUnit: label.energyUnit,
        carbs: Number(label.carbs), protein: Number(label.protein), fat: Number(label.fat), fibre: Number(label.fibre), updatedAt: Date.now(),
      } satisfies SavedPackagedProduct;
    });
    if (!labels.length) return;
    const next: SavedPackagedProduct[] = [...(savedProducts as SavedPackagedProduct[])];
    labels.forEach(label => {
      const index = next.findIndex((item: SavedPackagedProduct) => item.id === label.id);
      if (index >= 0) next[index] = label; else next.unshift(label);
    });
    onSaveProducts(next.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50));
  }

  function updateReviewName(index: number, value: string) {
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: value, fdcId: undefined, nutritionSource: undefined, calculationSource: undefined } : item));
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function togglePackageLabel(index: number, enabled: boolean) {
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, fdcId: undefined, nutritionSource: undefined, calculationSource: undefined, labelNutrition: enabled ? { productName: item.name || "Packaged food", energyValue: "", energyUnit: "kJ", carbs: "", protein: "", fat: "", fibre: "" } : undefined } : item));
    setReviewDirty(true); setConfirmedUpdate(false);
  }

  function selectSavedProduct(index: number, productId: string) {
    const product = (savedProducts as SavedPackagedProduct[]).find(item => item.id === productId);
    if (!product) return;
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      name: item.name || product.productName,
      fdcId: undefined,
      nutritionSource: undefined,
      calculationSource: undefined,
      labelNutrition: { productName: product.productName, energyValue: product.energyValue, energyUnit: product.energyUnit, carbs: product.carbs, protein: product.protein, fat: product.fat, fibre: product.fibre },
    } : item));
    setReviewDirty(true); setConfirmedUpdate(false);
  }

  function updateLabelField(index: number, field: keyof LabelNutritionDraft, rawValue: string) {
    setReviewItems(items => items.map((item, itemIndex) => {
      if (itemIndex !== index || !item.labelNutrition) return item;
      const value = field === "productName" || field === "energyUnit" ? rawValue : rawValue === "" ? "" : Math.max(0, Number(rawValue));
      return { ...item, labelNutrition: { ...item.labelNutrition, [field]: value } as LabelNutritionDraft };
    }));
    setReviewDirty(true); setConfirmedUpdate(false);
  }

  function labelIsComplete(item: ReviewIngredient) {
    const label = item.labelNutrition;
    if (!label) return true;
    const rawValues = [label.energyValue, label.carbs, label.protein, label.fat, label.fibre];
    if (rawValues.some(value => value === "")) return false;
    const values = rawValues.map(Number);
    return Boolean(label.productName.trim() && values[0] > 0 && values.every(value => Number.isFinite(value) && value >= 0));
  }

  function reviewValidationMessage() {
    if (reviewItems.length === 0) return "Add at least one ingredient.";
    if (reviewItems.some(item => !item.name.trim())) return "Enter a food name for every ingredient.";
    if (reviewItems.some(item => Number(item.amountGrams) <= 0)) return "Enter a gram amount greater than zero.";
    const incompleteLabel = reviewItems.find(item => item.labelNutrition && !labelIsComplete(item));
    if (incompleteLabel) return `Complete every package-label field for ${incompleteLabel.labelNutrition?.productName || incompleteLabel.name}. Light example text is not saved data.`;
    return "";
  }

  function updateReviewGrams(index: number, value: string) {
    const amountGrams = value === "" ? "" : Math.min(5000, Math.max(1, Math.round(Number(value) || 1)));
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, amountGrams } : item));
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function removeReviewItem(index: number) {
    setReviewItems(items => items.filter((_, itemIndex) => itemIndex !== index));
    setEditingIndex(null);
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function addReviewItem() {
    setReviewItems(items => [...items, { name: "", amountGrams: "", calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }]);
    setEditingIndex(reviewItems.length);
    setFixingResult(true);
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function recalculateReview() {
    const ingredients = reviewItems
      .map(item => ({ ...item, name: item.name.trim(), amountGrams: Number(item.amountGrams), labelNutrition: item.labelNutrition ? { productName: item.labelNutrition.productName.trim(), energyValue: Number(item.labelNutrition.energyValue), energyUnit: item.labelNutrition.energyUnit, carbs: Number(item.labelNutrition.carbs), protein: Number(item.labelNutrition.protein), fat: Number(item.labelNutrition.fat), fibre: Number(item.labelNutrition.fibre) } : undefined }))
      .filter(item => item.name && item.amountGrams > 0) as ReviewIngredient[];
    confirmedReviewRef.current = ingredients.map(ingredient => ({ ...ingredient }));
    setReviewItems(ingredients.map(ingredient => ({ ...ingredient })));
    onAnalyze([], { ingredients });
  }

  const reviewProblem = reviewDirty ? reviewValidationMessage() : "";

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><section className={`modal-sheet ${type === "result" ? "result-sheet" : ""}`}>
    <button className="modal-close" onClick={close}>×</button>
    {type === "water" && <WaterEditor water={water} goal={waterGoal} date={waterDate} onAdd={addWater} onSetTotal={setWaterTotal} onSaveGoal={saveWaterGoal} />}
    {type === "log" && <><div className="modal-icon">＋</div><p className="eyebrow">ADD FOOD</p><h2>How would you like to log?</h2><div className="modal-photo-actions"><PhotoPicker label="Take a photo" capture="environment" onPhoto={onPhoto} /><PhotoPicker label="Upload from library" onPhoto={onPhoto} secondary /></div><div className="modal-list"><button onClick={() => { close(); setTab("log"); }}><i>⌕</i><span><strong>Search or scan</strong><small>Food, meals and barcodes</small></span><b>›</b></button><button onClick={() => notify("Previous meals opened")}><i>↻</i><span><strong>Choose a previous meal</strong><small>Quickly log it again</small></span><b>›</b></button></div></>}
    {type === "scan" && <><div className={`scan-frame ${uploadedPhoto ? "has-photo" : ""}`} style={uploadedPhoto ? { backgroundImage: `url(${uploadedPhoto})` } : undefined}>{!uploadedPhoto && <div className="scan-food"><span>Photo</span><span>Upload</span><span>Preview</span></div>}<b>✓ Photo uploaded successfully</b></div><p className="eyebrow">PHOTO ANALYSIS</p><h2>Your meal photo is ready</h2><p className="modal-sub">NutriPath will identify visible foods, estimate portions and nutrition, and ask up to two questions when important details are unclear.</p>{analysisError && <div className="connection-notice"><b>Analysis couldn’t start</b><span>{analysisError}</span></div>}<button className="primary full" disabled={!uploadedData || analyzing} onClick={() => onAnalyze()}>{analyzing ? "Analyzing your meal…" : uploadedData ? "Analyze this photo" : "Preparing photo…"}</button><button className="text-button" onClick={() => next("log")}>Choose a different photo</button></>}
    {type === "clarify" && analysis && <><span className="step-label">{analysis.clarifyingQuestions.length} quick {analysis.clarifyingQuestions.length === 1 ? "question" : "questions"}</span><div className="modal-icon">?</div><h2>A little detail will improve your estimate</h2><p className="modal-sub">NutriPath identified this as <b>{analysis.mealName}</b>, with {analysis.confidence.toLowerCase()} confidence.</p><div className="question-list">{analysis.clarifyingQuestions.map((question: string, index: number) => <label key={question}><span>{question}</span><input value={answers[index] || ""} onChange={event => setAnswers(current => { const updated = [...current]; updated[index] = event.target.value; return updated; })} placeholder="Type your answer, or ‘not sure’" /></label>)}</div>{analysisError && <div className="connection-notice"><b>Couldn’t refine estimate</b><span>{analysisError}</span></div>}<button className="primary full" disabled={analyzing || analysis.clarifyingQuestions.some((_: string, index: number) => !answers[index]?.trim())} onClick={() => onAnalyze(answers)}>{analyzing ? "Refining estimate…" : "Update my estimate"}</button><button className="text-button" onClick={() => next("result")}>Use current estimate</button></>}
    {type === "result" && analysis && <>
      <div className={`result-photo ${uploadedPhoto ? "has-photo" : ""}`} style={uploadedPhoto ? { backgroundImage: `url(${uploadedPhoto})` } : undefined}>
        <div><span>{analysis.confidence} confidence</span><b>{analysis.calculationMethod === "nutrition_label" ? "Nutrition label calculation" : analysis.calculationMethod === "mixed_sources" ? "Mixed-source calculation" : analysis.calculationMethod === "verified_database" ? "Database calculation" : "AI estimate"}</b></div>
      </div>
      <div className="result-content">
        <div className="result-title-row"><div><p>SCANNED MEAL</p><h2>{analysis.mealName}</h2></div><button aria-label="Save meal for later">♡</button></div>
        <div className="calorie-summary"><strong>{analysis.calories.best}</strong><span>kcal</span><small>{analysis.calculationMethod && analysis.calculationMethod !== "ai_estimate" ? "Calculated from confirmed grams" : `${analysis.calories.low}–${analysis.calories.high} estimated range`}</small></div>
        <div className="result-macro-cards">
          <div className="carbs"><span>Carbs</span><strong>{analysis.carbs}g</strong></div>
          <div className="protein"><span>Protein</span><strong>{analysis.protein}g</strong></div>
          <div className="fat"><span>Fat</span><strong>{analysis.fat}g</strong></div>
        </div>
        {analysis.fibre > 0 && <div className="fibre-summary"><span>Fibre</span><strong>{analysis.fibre}g</strong><small>Shown separately from carbohydrates</small></div>}
        {confirmedUpdate && <div className="result-updated">✓ Changes saved — confirmed grams retained</div>}
        {analysis.uncertainties.length > 0 && <div className="result-uncertainty"><b>Estimate note</b><span>{analysis.uncertainties.join(" · ")}</span></div>}
        <div className="result-section-heading"><div><h3>Ingredients</h3><span>{reviewItems.length} detected</span></div><button className={fixingResult ? "active" : ""} onClick={() => { setFixingResult(value => !value); setEditingIndex(null); }}>{fixingResult ? "Done" : "Fix result"}</button></div>
        <div className="result-ingredient-list">
          {reviewItems.map((ingredient, index) => <div className="result-ingredient" key={index}>
            <div className="ingredient-summary">
              <button className="ingredient-main" disabled={!fixingResult} onClick={() => setEditingIndex(editingIndex === index ? null : index)}>
                <strong>{ingredient.name || "New ingredient"}</strong>
                <span>{ingredient.amountGrams ? `${ingredient.amountGrams} g` : "Add grams"} · {ingredient.calories} kcal</span>
                <small><i>C {ingredient.carbs}g</i><i>P {ingredient.protein}g</i><i>F {ingredient.fat}g</i></small>
                {ingredient.nutritionSource && <em className="ingredient-source">Source · {ingredient.nutritionSource}{ingredient.fdcId ? ` · FDC ID ${ingredient.fdcId}` : ""}</em>}
                {ingredient.calculationSource === "usda" && <em className="packaged-food-hint">Packaged product? Select Edit, then “Use package nutrition label” for the exact brand values.</em>}
              </button>
              {fixingResult && <button className="ingredient-edit-trigger" onClick={() => setEditingIndex(editingIndex === index ? null : index)}>{editingIndex === index ? "−" : "Edit"}</button>}
            </div>
            {fixingResult && editingIndex === index && <div className="ingredient-inline-editor">
              <label><span>Food</span><input value={ingredient.name} onChange={event => updateReviewName(index, event.target.value)} placeholder="Food name" /></label>
              <label><span>Grams</span><input type="number" inputMode="numeric" min="1" max="5000" step="1" value={ingredient.amountGrams} onChange={event => updateReviewGrams(index, event.target.value)} placeholder="120" /><small className="gram-unit">g</small></label>
              {savedProducts.length > 0 && <label className="saved-product-picker"><span>Saved packaged product</span><select value="" onChange={event => selectSavedProduct(index, event.target.value)}><option value="">Choose a saved product</option>{(savedProducts as SavedPackagedProduct[]).map(product => <option key={product.id} value={product.id}>{product.productName}</option>)}</select><small>Loads the saved per-100 g label values. You only need to confirm the portion grams.</small></label>}
              <label className="package-label-toggle"><input type="checkbox" checked={Boolean(ingredient.labelNutrition)} onChange={event => togglePackageLabel(index, event.target.checked)} /><span>Use package nutrition label</span></label>
              {ingredient.labelNutrition && <div className="package-label-fields">
                <div className="package-label-heading"><strong>Required values per 100 g</strong><small>Type every figure exactly as printed on the package.</small></div>
                <label className="product-name"><span>Product name</span><input value={ingredient.labelNutrition.productName} onChange={event => updateLabelField(index, "productName", event.target.value)} placeholder="Enter product name" /></label>
                <label><span>Energy</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.energyValue} onChange={event => updateLabelField(index, "energyValue", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Unit</span><select value={ingredient.labelNutrition.energyUnit} onChange={event => updateLabelField(index, "energyUnit", event.target.value)}><option value="kJ">kJ</option><option value="kcal">kcal</option></select></label>
                <label><span>Carbs (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.carbs} onChange={event => updateLabelField(index, "carbs", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Protein (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.protein} onChange={event => updateLabelField(index, "protein", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Fat (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.fat} onChange={event => updateLabelField(index, "fat", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Fibre (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.fibre} onChange={event => updateLabelField(index, "fibre", event.target.value)} placeholder="Enter value" /></label>
              </div>}
              <button onClick={() => removeReviewItem(index)}>Remove ingredient</button>
            </div>}
          </div>)}
        </div>
        {fixingResult && <>
          <button className="add-ingredient" onClick={addReviewItem}>＋ Add new ingredient</button>
          <details className="hidden-calories"><summary>Oil, butter, sauces <span>Add exact grams</span></summary><p>If one is missing, select “Add new ingredient,” enter its name, then enter the grams used. NutriPath will calculate it with the rest of the confirmed meal.</p></details>
        </>}
        {analysisError && <div className="connection-notice"><b>Couldn’t update estimate</b><span>{analysisError}</span></div>}
        {reviewProblem && <div className="review-validation-hint"><b>Complete the required fields</b><span>{reviewProblem}</span></div>}
        <div className="result-actions">
          {reviewDirty ? <button className="update-result" disabled={analyzing || Boolean(reviewProblem)} onClick={recalculateReview}>{analyzing ? "Recalculating confirmed foods…" : "Update nutrition"}</button> : <><button className="log-result" onClick={() => onAddAnalysis("today")}>Log meal · {analysis.calories.best} kcal</button><button className="plan-result" onClick={() => onAddAnalysis("plan")}>Add to plan</button></>}
        </div>
        <p className="fine-print">Package-label values are calculated exactly from the figures you enter. USDA values remain estimates and can vary by product and preparation. Verify ingredients, allergens and serving sizes. USDA does not endorse NutriPath.</p>
      </div>
    </>}
    {type === "profile" && <><div className="profile-head"><div className="avatar big">{profileInitials(profile?.name)}</div><div><h2>{profile?.name || "Your profile"}</h2><p>{profileGoalLabel(profile?.primary_goal)} · {profile?.weight_unit === "lb" ? "Imperial weight" : "Metric weight"}</p></div></div><div className="modal-list settings"><button onClick={() => next("weight")}><span><strong>Weight progress</strong><small>{weightLogs.length ? `${weightInUnit(weightLogs[weightLogs.length - 1].weight_kg, profile?.weight_unit || "kg").toFixed(1)} ${profile?.weight_unit || "kg"} · ${weightLogs.length} saved ${weightLogs.length === 1 ? "entry" : "entries"}` : "Log weight and review trends"}</small></span><b>›</b></button><button onClick={() => next("goals")}><span><strong>Goals & targets</strong><small>{Number(target || 0).toLocaleString()} kcal daily goal</small></span><b>›</b></button><button onClick={() => next("macros")}><span><strong>Macro targets</strong><small>{macroTargets.protein}g protein · {macroTargets.carbs}g carbs · {macroTargets.fat}g fat</small></span><b>›</b></button><button><span><strong>Dietary preferences</strong><small>No declared allergies</small></span><b>›</b></button><button><span><strong>Notifications</strong><small>All reminders off</small></span><b>›</b></button><button><span><strong>Subscription</strong><small>NutriPath account</small></span><b>›</b></button><button><span><strong>Privacy & your data</strong><small>Export or delete account</small></span><b>›</b></button></div><button className="text-button danger" disabled={loggingOut} onClick={onLogout}>{loggingOut ? "Logging out…" : "Log out"}</button></>}
    {type === "weight" && profile && <WeightProgressEditor profile={profile} logs={weightLogs} onBack={() => next("profile")} onReviewGoals={() => next("goals")} onSave={onSaveWeight} onDelete={onDeleteWeight} />}
    {type === "goals" && profile && <GoalsEditor profile={profile} onBack={() => next("profile")} onSave={onSaveProfileGoals} />}
    {type === "macros" && profile && <MacroTargetsEditor profile={profile} calorieGoal={target} currentTargets={macroTargets} onBack={() => next("profile")} onSave={onSaveProfileMacros} />}
    {type === "manual" && <ManualFoodEditor startMode={manualStartMode} initialFood={manualInitialFood} recentFoods={recentFoods} savedProducts={savedProducts} onAdd={onAddManualFood} />}
  </section></div>;
}
