"use client";
import { Progress } from "./components/Progress";
import { Today } from "./components/Today";
import { Plan } from "./components/Plan";
import { Log } from "./components/Log";
import { Grocery } from "./components/Grocery";
import { Modal } from "./components/Modal";
import { Brand, profileInitials } from "./components/ProfileEditors";
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
import { profileSelect, type MealRouteProfile } from "../lib/profile";
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
import { WeeklySummary } from "./components/WeeklySummary";
import { RecipeCreator } from "./components/RecipeCreator";
import { type Recipe } from "../lib/recipes";

import {
  localDateKey,
  weekRangeLabel,
  normalizeStoredMeal,
  normalizeStoredIngredients,
  normalizeMealList,
  normalizeStoredHistory,
  userStorageKey,
  readStorageJson,
  persistMealHistory,
  normalizeSavedProducts,
  readLegacyImportData,
  hasLegacyImportData,
  mergeMealLists,
  mergeMealHistory,
  mergeSavedProducts,
  dateFromKey,
  mealTotals,
  numericValue,
  nutritionValue,
  normalizeLabel,
  gramValue,
  normalizeAnalysis,
  SAVED_PRODUCTS_KEY,
  DAILY_MEALS_KEY,
  MEAL_HISTORY_KEY,
  LEGACY_IMPORT_DECISION_KEY,
  GROCERY_WEEK_KEY,
  type Tab,
  type PlanSubView,
  type Meal,
  type LabelNutrition,
  type SavedPackagedProduct,
  type LabelNutritionDraft,
  type AnalysisIngredient,
  type FoodAnalysis,
  type ReviewIngredient,
  type MealReview,
  type MealHistory,
  type StoredMealHistory,
  type LegacyImportData,
  type ProfileGoalUpdate,
  type ProfileMacroUpdate,
  type WeightSaveResult,
} from "../lib/app-utils";

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "⌂" }, { id: "plan", label: "My Plan", icon: "▦" },
  { id: "log", label: "Log Food", icon: "+" }, { id: "grocery", label: "Grocery", icon: "✓" },
  { id: "recipes", label: "Recipes", icon: "🍳" },
  { id: "progress", label: "History", icon: "↗" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [profile, setProfile] = useState<MealRouteProfile | null>(null);
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
  const [modal, setModal] = useState<null | "water" | "log" | "scan" | "clarify" | "result" | "profile" | "goals" | "macros" | "weight" | "manual" | "barcode">(null);
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
  const [focusPlanDate, setFocusPlanDate] = useState("");
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [planError, setPlanError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [sharingPlan, setSharingPlan] = useState(false);

  const meals = selectedDate ? mealHistory[selectedDate] || [] : [];
  const totals = mealTotals(meals);
  const consumed = totals.calories;
  const protein = totals.protein;
  const carbs = totals.carbs;
  const fat = totals.fat;
  const micros = totals.micros;
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

      const loadedProfile = data as MealRouteProfile;
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
          notify("MealRoute could not check this browser for older data.");
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
        body: JSON.stringify({ days, startDate: localDateKey() }),
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
    const baseId = Date.now();
    const newPlanned: Meal[] = mealsToSave.map((meal: PlanMeal, idx: number) => ({
      id: baseId * 1000 + idx,
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

  async function sharePlan() {
    if (!plannedMeals.length) {
      notify("Add meals to your plan before sharing.");
      return;
    }
    setSharingPlan(true);
    try {
      const weekMeals = mealsForWeek(plannedMeals, planWeekStart);
      const mealsToShare = (weekMeals.length ? weekMeals : plannedMeals).map(m => ({
        id: m.id, type: m.type, name: m.name, calories: m.calories,
        protein: m.protein, carbs: m.carbs, fat: m.fat, time: m.time,
        color: m.color, ingredients: m.ingredients, plannedDate: m.plannedDate,
        mealSlot: m.mealSlot,
      }));
      const res = await fetch("/api/share-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meals: mealsToShare,
          planTitle: `MealRoute Plan — ${weekRangeLabel(planWeekStart)}`,
          weekStart: planWeekStart,
        }),
      });
      const data = await res.json();
      if (data.error) {
        notify(data.error);
      } else {
        setShareUrl(data.shareUrl);
        notify("Share link created! 📋");
      }
    } catch {
      notify("Could not create share link.");
    } finally {
      setSharingPlan(false);
    }
  }

  function logRecipe(recipe: Recipe) {
    const today = localDateKey();
    const newMeal: Meal = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      type: "Recipe",
      name: recipe.name,
      calories: recipe.caloriesPerServing,
      protein: recipe.proteinPerServing,
      carbs: recipe.carbsPerServing,
      fat: recipe.fatPerServing,
      time: "",
      eaten: false,
      locked: false,
      color: "salmon",
      ingredients: recipe.ingredients.map(ing => ({ name: ing.name, amountGrams: ing.grams })),
      micros: recipe.micros && Object.values(recipe.micros).some(v => v > 0) ? recipe.micros : undefined,
    };
    const updated = { ...mealHistory, [today]: [...(mealHistory[today] || []), newMeal] };
    setMealHistory(updated);
    saveMealState(updated, plannedMeals, `Logged 1 serving of ${recipe.name} 🍽️`);
    setTab("today");
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
        ? "Saved on this device. MealRoute will need another update to sync it to your account."
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

    setProfile(data as MealRouteProfile);
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

    setProfile(data as MealRouteProfile);
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
          setProfile(data as MealRouteProfile);
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
        if (!error && data) setProfile(data as MealRouteProfile);
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
      notify("Your earlier MealRoute data is now saved to this account.");
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
      notify("This account will start with its own MealRoute data.");
    } catch {
      notify("MealRoute could not save that choice. Please try again.");
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
      notify("MealRoute could not log you out. Please try again.");
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
      return `That would exceed MealRoute’s ${MAX_DAILY_WATER_ML.toLocaleString()} ml daily entry limit.`;
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
    setProfile(data as MealRouteProfile);
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
    plannedDate?: string,
    mealSlot?: MealSlot,
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
      plannedDate: destination === "plan" ? plannedDate : undefined,
      mealSlot: destination === "plan" ? mealSlot : undefined,
    };

    let mealSaved: boolean;
    if (destination === "today") {
      const today = localDateKey();
      const nextHistory = { ...mealHistory, [today]: [...(mealHistory[today] || []), nextMeal] };
      setMealHistory(nextHistory);
      setSelectedDate(today);
      mealSaved = await saveMealState(nextHistory, plannedMeals, `${food.name} logged with ${nutrition.grams}g`);
    } else {
      if (plannedDate && mealSlot) {
        nextMeal.type = mealSlotLabels[mealSlot];
      }
      const nextPlan = [...plannedMeals, nextMeal];
      setPlannedMeals(nextPlan);
      mealSaved = await saveMealState(mealHistory, nextPlan, `${food.name} added to My Plan with ${nutrition.grams}g`);
      if (mealSaved) {
        await refreshGroceryForPlan(nextPlan);
        // Auto-navigate to the scheduled date in the plan view
        if (plannedDate) {
          setPlanSubView("week");
          setPlanWeekStart(weekStartKey(plannedDate));
          setFocusPlanDate(plannedDate);
        }
      }
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
        notify("The meal was saved, but MealRoute could not update Recent foods.");
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
  const title = tab === "today" ? !selectedDate || selectedDate === localDateKey() ? "Today" : selectedDateLabel : tab === "plan" ? "My Plan" : tab === "log" ? "Log Food" : tab === "grocery" ? "Grocery List" : tab === "recipes" ? "Recipes" : "History";
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
            ? <div className="history-empty"><strong>Loading your MealRoute account…</strong><span>Your meals, plan, History, and saved products are being restored securely.</span></div>
            : <>
              <ProfileCompletionBanner
                hasCalorieGoal={!!(profile?.calorie_goal && Number(profile.calorie_goal) > 0)}
                hasMacroGoals={profile?.protein_goal_g !== null && profile?.carbs_goal_g !== null && profile?.fat_goal_g !== null}
                onOpenGoals={() => setModal("goals")}
              />

              {tab === "today" && <Today meals={meals} selectedDate={selectedDate} onSelectDate={setSelectedDate} consumed={consumed} protein={protein} carbs={carbs} fat={fat} target={target} macroTargets={macroTargets} pct={pct} water={water} waterGoal={waterGoal} onMeal={markMeal} onWater={() => setModal("water")} onLog={() => setModal("log")} onBarcode={() => setModal("barcode")} micros={micros} />}
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
                        <h2 style={{ fontSize: "18px", margin: "0 0 8px", letterSpacing: "-.03em" }}>Let MealRoute plan your week</h2>
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
                      <Plan meals={plannedMeals} weekStart={planWeekStart || weekStartKey()} onWeekChange={setPlanWeekStart} onSchedule={updatePlannedMealSchedule} onRemove={removePlannedMeal} onLog={logPlannedMeal} onReviewGrocery={openWeeklyGrocery} focusDate={focusPlanDate} />
                      <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          className="primary"
                          onClick={sharePlan}
                          disabled={sharingPlan || !plannedMeals.length}
                          style={{ flex: "1", minWidth: "120px", fontSize: "11px", padding: "12px", borderRadius: "14px", opacity: sharingPlan || !plannedMeals.length ? 0.5 : 1 }}
                        >
                          {sharingPlan ? "Creating link…" : "🔗 Share Plan"}
                        </button>
                        <button
                          onClick={() => window.print()}
                          style={{ padding: "12px 16px", borderRadius: "14px", border: "1px solid #2c352f", background: "transparent", color: "#8e9a91", fontSize: "11px", fontWeight: 700 }}
                        >
                          📄 Print / PDF
                        </button>
                      </div>
                      {shareUrl && (
                        <div style={{ marginTop: "10px", padding: "12px", background: "rgba(169,244,122,0.08)", border: "1px solid #2d392f", borderRadius: "12px" }}>
                          <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 6px" }}>SHARE LINK</p>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <input
                              type="text"
                              readOnly
                              value={shareUrl}
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                              style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--panel)", color: "var(--green)", fontSize: "11px" }}
                            />
                            <button
                              onClick={() => { navigator.clipboard.writeText(shareUrl); notify("Link copied! 📋"); }}
                              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--green)", background: "transparent", color: "var(--green)", fontSize: "11px", fontWeight: 700 }}
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      )}
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
                      foodPalette={foodPalette.map(f => ({ food_name: f.foodName, calories_per_100g: f.caloriesPer100g, protein_per_100g: f.proteinPer100g, carbs_per_100g: f.carbsPer100g, fat_per_100g: f.fatPer100g, preferred_slots: f.preferredSlots }))}
                      onAccept={(meals) => handleAcceptPlan(meals)}
                      onReject={handleRejectPlan}
                      onRegenerateMeal={handleRegenerateMeal}
                    />
                  )}
                </>
              )}
              {tab === "log" && <Log onPhoto={usePhoto} notify={notify} recentFoods={recentFoods} savedProducts={savedProducts} onManual={openManualFood} onBarcode={() => setModal("barcode")} />}
              {tab === "grocery" && <Grocery items={groceryItems} ready={groceryReady} weekLabel={groceryWeekLabel} onToggle={toggleGroceryItem} onAddCustom={addCustomGroceryItem} onRemoveCustom={removeCustomGroceryItem} onOpenPlan={() => setTab("plan")} />}
              {tab === "recipes" && <RecipeCreator onLogRecipe={logRecipe} />}
              {tab === "progress" && <>
                <Progress range={range} setRange={setRange} history={mealHistory} target={target} proteinTarget={macroTargets.protein} weightLogs={weightLogs} weightUnit={profile?.weight_unit || "kg"} onLogWeight={() => setModal("weight")} />
                <WeeklySummary profile={profile} />
              </>}
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
        <h2>Bring your earlier MealRoute data into this account?</h2>
        <p className="modal-sub">This browser contains {legacyMealCount} {legacyMealCount === 1 ? "meal or plan" : "meals or plans"} and {legacyImport.savedProducts.length} saved {legacyImport.savedProducts.length === 1 ? "product" : "products"}. Importing saves them under this signed-in account without duplicating existing records.</p>
        <div className="connection-notice"><b>Your account stays private</b><span>After import, this data is protected by your Supabase user ID and will not be shown to other MealRoute accounts.</span></div>
        <button className="primary full" disabled={importingLegacy} onClick={importLegacyData}>{importingLegacy ? "Importing securely…" : "Import to my account"}</button>
        <button className="text-button" disabled={importingLegacy} onClick={skipLegacyImport}>Keep this account separate</button>
      </section></div>}
      {modal && <Modal type={modal} close={() => setModal(null)} addWater={addWater} setWaterTotal={saveWaterTotal} saveWaterGoal={saveWaterGoal} water={water} waterGoal={waterGoal} waterDate={selectedDate || localDateKey()} next={setModal} notify={notify} setTab={setTab} onPhoto={usePhoto} uploadedPhoto={uploadedPhoto} uploadedData={uploadedData} analysis={analysis} analyzing={analyzing} analysisError={analysisError} onAnalyze={analyzePhoto} onAddAnalysis={addAnalyzedMeal} profile={profile} target={target} macroTargets={macroTargets} onLogout={logout} loggingOut={loggingOut} savedProducts={savedProducts} onSaveProducts={(products: SavedPackagedProduct[]) => { setSavedProducts(products); void saveProductState(products); }} onSaveProfileGoals={saveProfileGoals} onSaveProfileMacros={saveProfileMacros} weightLogs={weightLogs} onSaveWeight={saveWeightEntry} onDeleteWeight={deleteWeightEntry} manualStartMode={manualStartMode} manualInitialFood={manualInitialFood} recentFoods={recentFoods} onAddManualFood={addManualFood} />}
      <LegalFooter />
    </main>
  );
}

