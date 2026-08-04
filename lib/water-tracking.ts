import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_WATER_GOAL_ML = 2500;
export const MIN_WATER_GOAL_ML = 250;
export const MAX_WATER_GOAL_ML = 10000;
export const MAX_DAILY_WATER_ML = 20000;

export type WaterDay = {
  id: string;
  user_id: string;
  log_date: string;
  amount_ml: number;
  created_at: string;
  updated_at: string;
};

function normalizeWaterDay(row: Record<string, unknown>): WaterDay {
  return {
    id: String(row.id || ""),
    user_id: String(row.user_id || ""),
    log_date: String(row.log_date || ""),
    amount_ml: Math.round(Number(row.amount_ml) || 0),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
  };
}

export function waterDaysByDate(days: WaterDay[]) {
  return Object.fromEntries(days.map(day => [day.log_date, day])) as Record<string, WaterDay>;
}

export async function loadWaterDays(
  supabase: SupabaseClient,
  userId: string,
): Promise<WaterDay[]> {
  const { data, error } = await supabase
    .from("water_daily_totals")
    .select("id,user_id,log_date,amount_ml,created_at,updated_at")
    .eq("user_id", userId)
    .order("log_date", { ascending: true });

  if (error) throw error;
  return (data || []).map(row => normalizeWaterDay(row));
}

export async function upsertWaterDay(
  supabase: SupabaseClient,
  userId: string,
  logDate: string,
  amountMl: number,
): Promise<WaterDay> {
  const normalizedAmount = Math.round(amountMl);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) throw new Error("Choose a valid date.");
  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0 || normalizedAmount > MAX_DAILY_WATER_ML) {
    throw new Error(`Daily water must be between 0 and ${MAX_DAILY_WATER_ML.toLocaleString()} ml.`);
  }

  const { data, error } = await supabase
    .from("water_daily_totals")
    .upsert(
      {
        user_id: userId,
        log_date: logDate,
        amount_ml: normalizedAmount,
      },
      { onConflict: "user_id,log_date" },
    )
    .select("id,user_id,log_date,amount_ml,created_at,updated_at")
    .single();

  if (error || !data) throw error || new Error("The water total could not be saved.");
  return normalizeWaterDay(data);
}
