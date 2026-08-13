import type { SupabaseClient } from "@supabase/supabase-js";

export type FoodPreference = {
  id: string;
  foodName: string;
  fdcId?: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fibrePer100g: number;
  category: string;
  preferredSlots: string[];
  createdAt: string;
  updatedAt: string;
};

export type FoodPreferenceInput = Omit<FoodPreference, "id" | "createdAt" | "updatedAt">;

function normalizeRow(row: Record<string, unknown>): FoodPreference {
  return {
    id: String(row.id || ""),
    foodName: String(row.food_name || ""),
    fdcId: Number.isFinite(Number(row.fdc_id)) && Number(row.fdc_id) > 0
      ? Math.round(Number(row.fdc_id))
      : undefined,
    caloriesPer100g: Number(row.calories_per_100g) || 0,
    proteinPer100g: Number(row.protein_per_100g) || 0,
    carbsPer100g: Number(row.carbs_per_100g) || 0,
    fatPer100g: Number(row.fat_per_100g) || 0,
    fibrePer100g: Number(row.fibre_per_100g) || 0,
    category: String(row.category || "Other"),
    preferredSlots: Array.isArray(row.preferred_slots)
      ? row.preferred_slots.map(String)
      : ["breakfast", "lunch", "dinner", "snack"],
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export async function loadFoodPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<FoodPreference[]> {
  const { data, error } = await supabase
    .from("food_preferences")
    .select("id,food_name,fdc_id,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fibre_per_100g,category,preferred_slots,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(row => normalizeRow(row));
}

export async function addFoodPreference(
  supabase: SupabaseClient,
  userId: string,
  input: FoodPreferenceInput,
): Promise<FoodPreference> {
  const { data, error } = await supabase
    .from("food_preferences")
    .insert({
      user_id: userId,
      food_name: input.foodName.slice(0, 160),
      fdc_id: input.fdcId || null,
      calories_per_100g: input.caloriesPer100g,
      protein_per_100g: input.proteinPer100g,
      carbs_per_100g: input.carbsPer100g,
      fat_per_100g: input.fatPer100g,
      fibre_per_100g: input.fibrePer100g,
      category: input.category,
      preferred_slots: input.preferredSlots,
    })
    .select("id,food_name,fdc_id,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fibre_per_100g,category,preferred_slots,created_at,updated_at")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("This food is already in your preferences.");
    }
    throw error || new Error("Could not save this food preference.");
  }
  return normalizeRow(data);
}

export async function deleteFoodPreference(
  supabase: SupabaseClient,
  userId: string,
  prefId: string,
): Promise<void> {
  const { error } = await supabase
    .from("food_preferences")
    .delete()
    .eq("id", prefId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function updateFoodPreferenceSlots(
  supabase: SupabaseClient,
  userId: string,
  prefId: string,
  slots: string[],
): Promise<void> {
  const { error } = await supabase
    .from("food_preferences")
    .update({ preferred_slots: slots })
    .eq("id", prefId)
    .eq("user_id", userId);

  if (error) throw error;
}
