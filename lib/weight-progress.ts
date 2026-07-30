import type { SupabaseClient } from "@supabase/supabase-js";

export type WeightLog = {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_on: string;
  created_at: string;
  updated_at: string;
};

function normalizeWeightLog(row: Record<string, unknown>): WeightLog {
  return {
    id: String(row.id || ""),
    user_id: String(row.user_id || ""),
    weight_kg: Number(row.weight_kg),
    logged_on: String(row.logged_on || ""),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
  };
}

export function weightInUnit(weightKg: number, unit: "kg" | "lb") {
  const converted = unit === "lb" ? weightKg * 2.20462 : weightKg;
  return Math.round(converted * 10) / 10;
}

export function weightToKg(weight: number, unit: "kg" | "lb") {
  const converted = unit === "lb" ? weight / 2.20462 : weight;
  return Math.round(converted * 100) / 100;
}

export async function loadWeightLogs(
  supabase: SupabaseClient,
  userId: string,
): Promise<WeightLog[]> {
  const { data, error } = await supabase
    .from("weight_logs")
    .select("id,user_id,weight_kg,logged_on,created_at,updated_at")
    .eq("user_id", userId)
    .order("logged_on", { ascending: true });

  if (error) throw error;
  return (data || []).map(row => normalizeWeightLog(row));
}

export async function upsertWeightLog(
  supabase: SupabaseClient,
  userId: string,
  loggedOn: string,
  weightKg: number,
): Promise<WeightLog> {
  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(
      {
        user_id: userId,
        logged_on: loggedOn,
        weight_kg: weightKg,
      },
      { onConflict: "user_id,logged_on" },
    )
    .select("id,user_id,weight_kg,logged_on,created_at,updated_at")
    .single();

  if (error || !data) throw error || new Error("The weight entry could not be saved.");
  return normalizeWeightLog(data);
}

export async function removeWeightLog(
  supabase: SupabaseClient,
  userId: string,
  logId: string,
) {
  const { error } = await supabase
    .from("weight_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", userId);

  if (error) throw error;
}
