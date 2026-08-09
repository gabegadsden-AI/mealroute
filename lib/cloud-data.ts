import type { SupabaseClient } from "@supabase/supabase-js";
import { isDateKey, normalizeMealSlot, type MealSlot } from "./weekly-plan";

export type CloudMeal = {
  id: number;
  type: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  eaten: boolean;
  locked?: boolean;
  color: string;
  ingredients?: CloudMealIngredient[];
  plannedDate?: string;
  mealSlot?: MealSlot;
};

export type CloudMealIngredient = {
  name: string;
  amountGrams: number;
};

export type CloudMealHistory = Record<string, CloudMeal[]>;

export type CloudSavedProduct = {
  id: string;
  productName: string;
  energyValue: number;
  energyUnit: "kcal" | "kJ";
  carbs: number;
  protein: number;
  fat: number;
  fibre: number;
  updatedAt: number;
};

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function totalsFor(meals: CloudMeal[]) {
  return meals.filter(meal => meal.eaten).reduce((totals, meal) => ({
    calories: totals.calories + meal.calories,
    protein: totals.protein + meal.protein,
    carbs: totals.carbs + meal.carbs,
    fat: totals.fat + meal.fat,
    meals: totals.meals + 1,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 });
}

function normalizeMealIngredients(raw: unknown): CloudMealIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => ({
      name: String(item?.name || "").replace(/\s+/g, " ").trim().slice(0, 160),
      amountGrams: numberValue(item?.amountGrams),
    }))
    .filter(item => item.name && item.amountGrams > 0 && item.amountGrams <= 5000);
}

export async function loadCloudState(supabase: SupabaseClient, userId: string) {
  const [mealsResult, productsResult] = await Promise.all([
    supabase
      .from("meal_entries")
      .select("client_id,entry_kind,meal_date,meal_slot,meal_type,name,calories,protein,carbs,fat,meal_time,eaten,locked,color,ingredients")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("saved_packaged_products")
      .select("product_key,product_name,energy_value,energy_unit,carbs,protein,fat,fibre,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);

  if (mealsResult.error) throw mealsResult.error;
  if (productsResult.error) throw productsResult.error;

  const days: CloudMealHistory = {};
  const planned: CloudMeal[] = [];

  (mealsResult.data || []).forEach(row => {
    const meal: CloudMeal = {
      id: numberValue(row.client_id),
      type: String(row.meal_type || "Logged meal"),
      name: String(row.name || "Meal"),
      calories: numberValue(row.calories),
      protein: numberValue(row.protein),
      carbs: numberValue(row.carbs),
      fat: numberValue(row.fat),
      time: String(row.meal_time || ""),
      eaten: Boolean(row.eaten),
      locked: row.locked ? true : undefined,
      color: String(row.color || "salmon"),
      ingredients: normalizeMealIngredients(row.ingredients),
      plannedDate: row.entry_kind === "planned" && isDateKey(row.meal_date) ? String(row.meal_date) : undefined,
      mealSlot: row.entry_kind === "planned" ? normalizeMealSlot(row.meal_slot) : undefined,
    };
    if (row.entry_kind === "planned") {
      planned.push(meal);
      return;
    }
    const date = String(row.meal_date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    days[date] = [...(days[date] || []), meal];
  });

  const savedProducts: CloudSavedProduct[] = (productsResult.data || []).map(row => ({
    id: String(row.product_key),
    productName: String(row.product_name),
    energyValue: numberValue(row.energy_value),
    energyUnit: row.energy_unit === "kJ" ? "kJ" : "kcal",
    carbs: numberValue(row.carbs),
    protein: numberValue(row.protein),
    fat: numberValue(row.fat),
    fibre: numberValue(row.fibre),
    updatedAt: new Date(row.updated_at).getTime(),
  }));

  return { days, planned, savedProducts };
}

export async function syncCloudMeals(
  supabase: SupabaseClient,
  userId: string,
  days: CloudMealHistory,
  planned: CloudMeal[],
) {
  const mealRows = [
    ...Object.entries(days).flatMap(([date, meals]) => meals.map(meal => ({
      user_id: userId,
      client_key: `daily:${date}:${meal.id}`,
      client_id: meal.id,
      entry_kind: "daily",
      meal_date: date,
      meal_type: meal.type,
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      meal_time: meal.time,
      eaten: meal.eaten,
      locked: Boolean(meal.locked),
      color: meal.color,
      ingredients: normalizeMealIngredients(meal.ingredients),
      meal_slot: null,
    }))),
    ...planned.map(meal => ({
      user_id: userId,
      client_key: `planned:${meal.id}`,
      client_id: meal.id,
      entry_kind: "planned",
      meal_date: meal.plannedDate || null,
      meal_slot: meal.mealSlot || null,
      meal_type: meal.type,
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      meal_time: meal.time,
      eaten: meal.eaten,
      locked: Boolean(meal.locked),
      color: meal.color,
      ingredients: normalizeMealIngredients(meal.ingredients),
    })),
  ];

  if (mealRows.length) {
    const { error } = await supabase
      .from("meal_entries")
      .upsert(mealRows, { onConflict: "user_id,client_key" });
    if (error) throw error;
  }

  const activePlannedKeys = new Set(planned.map(meal => `planned:${meal.id}`));
  const { data: storedPlanned, error: plannedReadError } = await supabase
    .from("meal_entries")
    .select("client_key")
    .eq("user_id", userId)
    .eq("entry_kind", "planned");
  if (plannedReadError) throw plannedReadError;
  const stalePlannedKeys = (storedPlanned || [])
    .map(row => String(row.client_key || ""))
    .filter(key => key && !activePlannedKeys.has(key));
  if (stalePlannedKeys.length) {
    const { error } = await supabase
      .from("meal_entries")
      .delete()
      .eq("user_id", userId)
      .eq("entry_kind", "planned")
      .in("client_key", stalePlannedKeys);
    if (error) throw error;
  }

  const totalRows = Object.entries(days).map(([date, meals]) => {
    const totals = totalsFor(meals);
    return {
      user_id: userId,
      total_date: date,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      meals_logged: totals.meals,
    };
  });

  if (totalRows.length) {
    const { error } = await supabase
      .from("daily_nutrition_totals")
      .upsert(totalRows, { onConflict: "user_id,total_date" });
    if (error) throw error;
  }
}

export async function syncCloudProducts(
  supabase: SupabaseClient,
  userId: string,
  products: CloudSavedProduct[],
) {
  if (!products.length) return;
  const rows = products.map(product => ({
    user_id: userId,
    product_key: product.id,
    product_name: product.productName,
    energy_value: product.energyValue,
    energy_unit: product.energyUnit,
    carbs: product.carbs,
    protein: product.protein,
    fat: product.fat,
    fibre: product.fibre,
    updated_at: new Date(product.updatedAt).toISOString(),
  }));
  const { error } = await supabase
    .from("saved_packaged_products")
    .upsert(rows, { onConflict: "user_id,product_key" });
  if (error) throw error;
}

export async function setLocalImportStatus(
  supabase: SupabaseClient,
  userId: string,
  status: "imported" | "skipped",
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      local_import_status: status,
      local_imported_at: status === "imported" ? new Date().toISOString() : null,
    })
    .eq("user_id", userId);
  if (error) throw error;
}
