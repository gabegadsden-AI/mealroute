import type { SupabaseClient } from "@supabase/supabase-js";

export type ManualFoodSource = "usda" | "nutrition_label" | "custom";

export type ManualFoodItem = {
  sourceKey: string;
  sourceType: ManualFoodSource;
  name: string;
  brandName?: string;
  fdcId?: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fibrePer100g: number;
  nutritionSource: string;
  timesUsed?: number;
  lastUsedAt?: string;
  lastGrams?: number;
};

export type ManualFoodNutrition = {
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
};

const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function normalizeRecentFood(row: Record<string, unknown>): ManualFoodItem {
  const fdcId = Number(row.fdc_id);
  return {
    sourceKey: String(row.source_key || ""),
    sourceType: ["usda", "nutrition_label", "custom"].includes(String(row.source_type))
      ? String(row.source_type) as ManualFoodSource
      : "custom",
    name: String(row.name || "Saved food"),
    brandName: String(row.brand_name || "") || undefined,
    fdcId: Number.isFinite(fdcId) && fdcId > 0 ? Math.round(fdcId) : undefined,
    caloriesPer100g: numberValue(row.calories_per_100g),
    proteinPer100g: numberValue(row.protein_per_100g),
    carbsPer100g: numberValue(row.carbs_per_100g),
    fatPer100g: numberValue(row.fat_per_100g),
    fibrePer100g: numberValue(row.fibre_per_100g),
    nutritionSource: String(row.nutrition_source || "Manual nutrition"),
    timesUsed: Math.max(0, Math.round(numberValue(row.times_used))),
    lastUsedAt: String(row.last_used_at || ""),
    lastGrams: numberValue(row.last_grams) || undefined,
  };
}

export function calculateManualNutrition(
  food: ManualFoodItem,
  grams: number,
): ManualFoodNutrition {
  const safeGrams = Math.min(5000, Math.max(1, Math.round(grams * 10) / 10));
  const ratio = safeGrams / 100;
  return {
    grams: safeGrams,
    calories: Math.round(food.caloriesPer100g * ratio),
    protein: round1(food.proteinPer100g * ratio),
    carbs: round1(food.carbsPer100g * ratio),
    fat: round1(food.fatPer100g * ratio),
    fibre: round1(food.fibrePer100g * ratio),
  };
}

export function packagedProductFood(product: {
  id: string;
  productName: string;
  energyValue: number;
  energyUnit: "kcal" | "kJ";
  carbs: number;
  protein: number;
  fat: number;
  fibre: number;
}): ManualFoodItem {
  return {
    sourceKey: `label:${product.id}`,
    sourceType: "nutrition_label",
    name: product.productName,
    caloriesPer100g: product.energyUnit === "kJ" ? product.energyValue / 4.184 : product.energyValue,
    proteinPer100g: product.protein,
    carbsPer100g: product.carbs,
    fatPer100g: product.fat,
    fibrePer100g: product.fibre,
    nutritionSource: `Nutrition label · ${product.productName}`,
  };
}

export function customFoodKey(food: Omit<ManualFoodItem, "sourceKey">) {
  const normalizedName = food.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const nutritionKey = [
    food.caloriesPer100g,
    food.proteinPer100g,
    food.carbsPer100g,
    food.fatPer100g,
    food.fibrePer100g,
  ].map(value => round1(value)).join("-");
  return `custom:${normalizedName || "food"}:${nutritionKey}`;
}

export async function loadRecentFoods(
  supabase: SupabaseClient,
  userId: string,
): Promise<ManualFoodItem[]> {
  const { data, error } = await supabase
    .from("recent_foods")
    .select("source_key,source_type,name,brand_name,fdc_id,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fibre_per_100g,nutrition_source,times_used,last_used_at,last_grams")
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data || []).map(row => normalizeRecentFood(row));
}

export async function saveRecentFood(
  supabase: SupabaseClient,
  userId: string,
  food: ManualFoodItem,
  previousUseCount: number,
  grams: number,
): Promise<ManualFoodItem> {
  const { data, error } = await supabase
    .from("recent_foods")
    .upsert({
      user_id: userId,
      source_key: food.sourceKey.slice(0, 220),
      source_type: food.sourceType,
      name: food.name.slice(0, 160),
      brand_name: food.brandName?.slice(0, 160) || null,
      fdc_id: food.fdcId || null,
      calories_per_100g: food.caloriesPer100g,
      protein_per_100g: food.proteinPer100g,
      carbs_per_100g: food.carbsPer100g,
      fat_per_100g: food.fatPer100g,
      fibre_per_100g: food.fibrePer100g,
      nutrition_source: food.nutritionSource.slice(0, 240),
      times_used: Math.max(1, previousUseCount + 1),
      last_grams: Math.min(5000, Math.max(1, Math.round(grams * 10) / 10)),
      last_used_at: new Date().toISOString(),
    }, { onConflict: "user_id,source_key" })
    .select("source_key,source_type,name,brand_name,fdc_id,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fibre_per_100g,nutrition_source,times_used,last_used_at,last_grams")
    .single();

  if (error || !data) throw error || new Error("The recent food could not be saved.");
  return normalizeRecentFood(data);
}
