import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";

export type SharedPlanMeal = {
  id: number;
  type: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  color: string;
  ingredients?: { name: string; amountGrams: number }[];
  plannedDate?: string;
  mealSlot?: string;
};

export type SharedPlan = {
  id: string;
  shareToken: string;
  planTitle: string;
  weekStart: string;
  meals: SharedPlanMeal[];
  createdAt: string;
};

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export async function createSharedPlan(
  supabase: SupabaseClient,
  userId: string,
  meals: SharedPlanMeal[],
  planTitle: string,
  weekStart?: string,
): Promise<SharedPlan> {
  const shareToken = generateToken();
  const { data, error } = await supabase
    .from("shared_plans")
    .insert({
      user_id: userId,
      share_token: shareToken,
      plan_data: meals,
      plan_title: planTitle.slice(0, 200),
      week_start: weekStart || null,
    })
    .select("id,share_token,plan_title,week_start,plan_data,created_at")
    .single();

  if (error || !data) throw error || new Error("Could not create share link.");
  return {
    id: String(data.id),
    shareToken: String(data.share_token),
    planTitle: String(data.plan_title || "My Meal Plan"),
    weekStart: String(data.week_start || ""),
    meals: Array.isArray(data.plan_data) ? data.plan_data : [],
    createdAt: String(data.created_at || ""),
  };
}

export async function loadSharedPlanByToken(token: string): Promise<SharedPlan | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shared_plans")
    .select("id,share_token,plan_title,week_start,plan_data,created_at,expires_at")
    .eq("share_token", token)
    .maybeSingle();

  if (error || !data) return null;

  // Check expiration
  if (data.expires_at) {
    const expires = new Date(String(data.expires_at));
    if (expires.getTime() < Date.now()) return null;
  }

  return {
    id: String(data.id),
    shareToken: String(data.share_token),
    planTitle: String(data.plan_title || "My Meal Plan"),
    weekStart: String(data.week_start || ""),
    meals: Array.isArray(data.plan_data) ? data.plan_data : [],
    createdAt: String(data.created_at || ""),
  };
}

export async function deleteSharedPlan(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
): Promise<void> {
  const { error } = await supabase
    .from("shared_plans")
    .delete()
    .eq("id", planId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function listUserSharedPlans(
  supabase: SupabaseClient,
  userId: string,
): Promise<SharedPlan[]> {
  const { data, error } = await supabase
    .from("shared_plans")
    .select("id,share_token,plan_title,week_start,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data || []).map(row => ({
    id: String(row.id),
    shareToken: String(row.share_token),
    planTitle: String(row.plan_title || "My Meal Plan"),
    weekStart: String(row.week_start || ""),
    meals: [],
    createdAt: String(row.created_at || ""),
  }));
}
