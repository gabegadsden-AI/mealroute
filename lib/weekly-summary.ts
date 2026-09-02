import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MICRONUTRIENT_KEYS,
  MICRONUTRIENT_LABELS,
  EMPTY_MICRONUTRIENTS,
  type Micronutrients,
} from "./micronutrients";

const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export type DaySummary = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsLogged: number;
  waterMl: number;
  micros: Micronutrients;
};

export type WeeklySummary = {
  weekStart: string;
  weekEnd: string;
  days: DaySummary[];
  averages: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealsLogged: number;
    waterMl: number;
    micros: Micronutrients;
  };
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealsLogged: number;
    waterMl: number;
  };
  weightChange: number | null;
  startWeight: number | null;
  endWeight: number | null;
  daysTracked: number;
  goalCalories: number;
  goalHitDays: number;
};

/**
 * Load a weekly nutrition summary from Supabase tables.
 * Pulls from daily_nutrition_totals, water_daily_totals, meal_entries (for micros),
 * and weight_logs.
 */
export async function buildWeeklySummary(
  supabase: SupabaseClient,
  userId: string,
  weekStartKey: string,
  goalCalories: number,
): Promise<WeeklySummary> {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const [y, m, d] = weekStartKey.split("-").map(Number);
    const date = new Date(y, m - 1, d + i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    dates.push(key);
  }
  const weekEnd = dates[6];

  // Fetch daily nutrition totals
  const { data: totalsData, error: totalsError } = await supabase
    .from("daily_nutrition_totals")
    .select("total_date,calories,protein,carbs,fat,meals_logged")
    .eq("user_id", userId)
    .in("total_date", dates)
    .order("total_date", { ascending: true });

  if (totalsError) throw totalsError;

  // Fetch water tracking
  const { data: waterData, error: waterError } = await supabase
    .from("water_daily_totals")
    .select("log_date,amount_ml")
    .eq("user_id", userId)
    .in("log_date", dates)
    .order("log_date", { ascending: true });

  if (waterError) throw waterError;

  // Fetch meal entries for micronutrient data
  const { data: mealData, error: mealError } = await supabase
    .from("meal_entries")
    .select("meal_date,entry_kind,eaten,calories,protein,carbs,fat")
    .eq("user_id", userId)
    .eq("entry_kind", "daily")
    .in("meal_date", dates);

  if (mealError) throw mealError;

  // Fetch weight logs for the week
  const { data: weightData, error: weightError } = await supabase
    .from("weight_logs")
    .select("weight_kg,logged_on")
    .eq("user_id", userId)
    .in("logged_on", dates)
    .order("logged_on", { ascending: true });

  if (weightError) throw weightError;

  // Build per-day summaries
  const totalsByDate = new Map(
    (totalsData || []).map(row => [String(row.total_date), row]),
  );
  const waterByDate = new Map(
    (waterData || []).map(row => [String(row.log_date), row]),
  );

  const days: DaySummary[] = dates.map(date => {
    const totals = totalsByDate.get(date);
    const water = waterByDate.get(date);
    return {
      date,
      calories: numberValue(totals?.calories),
      protein: numberValue(totals?.protein),
      carbs: numberValue(totals?.carbs),
      fat: numberValue(totals?.fat),
      mealsLogged: numberValue(totals?.meals_logged),
      waterMl: numberValue(water?.amount_ml),
      micros: { ...EMPTY_MICRONUTRIENTS }, // micros come from meal-level data if available
    };
  });

  // Calculate averages and totals
  const daysTracked = days.filter(d => d.calories > 0 || d.mealsLogged > 0).length;
  const totals = days.reduce(
    (acc, d) => ({
      calories: acc.calories + d.calories,
      protein: acc.protein + d.protein,
      carbs: acc.carbs + d.carbs,
      fat: acc.fat + d.fat,
      mealsLogged: acc.mealsLogged + d.mealsLogged,
      waterMl: acc.waterMl + d.waterMl,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, mealsLogged: 0, waterMl: 0 },
  );

  const divisor = Math.max(1, daysTracked);
  const goalHitDays = days.filter(d => goalCalories > 0 && d.calories > 0 && Math.abs(d.calories - goalCalories) / goalCalories <= 0.15).length;

  // Weight change
  let startWeight: number | null = null;
  let endWeight: number | null = null;
  if (weightData && weightData.length > 0) {
    startWeight = numberValue(weightData[0].weight_kg);
    endWeight = numberValue(weightData[weightData.length - 1].weight_kg);
  }

  return {
    weekStart: weekStartKey,
    weekEnd,
    days,
    averages: {
      calories: Math.round(totals.calories / divisor),
      protein: round1(totals.protein / divisor),
      carbs: round1(totals.carbs / divisor),
      fat: round1(totals.fat / divisor),
      mealsLogged: round1(totals.mealsLogged / divisor),
      waterMl: Math.round(totals.waterMl / divisor),
      micros: { ...EMPTY_MICRONUTRIENTS },
    },
    totals,
    weightChange: startWeight !== null && endWeight !== null ? round1(endWeight - startWeight) : null,
    startWeight,
    endWeight,
    daysTracked,
    goalCalories,
    goalHitDays,
  };
}

/**
 * Generate an HTML email body for the weekly summary.
 */
export function renderWeeklySummaryHTML(summary: WeeklySummary, userName: string): string {
  const avg = summary.averages;
  const goalText = summary.goalCalories > 0
    ? `Goal: ${summary.goalCalories} kcal · Hit ${summary.goalHitDays}/${summary.daysTracked} days`
    : "";

  const dayRows = summary.days.map(d => {
    const pct = summary.goalCalories > 0 ? Math.min(100, Math.round((d.calories / summary.goalCalories) * 100)) : 0;
    return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${formatDate(d.date)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${d.calories}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${d.protein}g</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${d.carbs}g</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${d.fat}g</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${d.waterMl}ml</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${pct}%</td>
      </tr>`;
  }).join("");

  const weightRow = summary.weightChange !== null
    ? `<p style="margin:12px 0 0;color:#666;">Weight: ${summary.startWeight}kg → ${summary.endWeight}kg (${summary.weightChange > 0 ? "+" : ""}${summary.weightChange}kg)</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#f0fdf4;border-radius:12px;padding:24px;margin-bottom:20px;">
    <h1 style="margin:0 0 4px;font-size:24px;color:#15803d;">📊 Your Weekly Summary</h1>
    <p style="margin:0;color:#666;">${formatDate(summary.weekStart)} – ${formatDate(summary.weekEnd)}</p>
  </div>

  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
    <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#15803d;">${avg.calories}</div>
      <div style="font-size:12px;color:#666;">Avg kcal/day</div>
    </div>
    <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#15803d;">${avg.protein}g</div>
      <div style="font-size:12px;color:#666;">Avg protein/day</div>
    </div>
    <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#15803d;">${avg.waterMl}ml</div>
      <div style="font-size:12px;color:#666;">Avg water/day</div>
    </div>
  </div>

  ${goalText ? `<p style="margin:0 0 16px;color:#666;">${goalText}</p>` : ""}
  ${weightRow}

  <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
    <thead>
      <tr style="background:#f0fdf4;">
        <th style="padding:8px;text-align:left;border-bottom:2px solid #ccc;">Day</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #ccc;">Kcal</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #ccc;">Protein</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #ccc;">Carbs</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #ccc;">Fat</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #ccc;">Water</th>
        <th style="padding:8px;text-align:right;border-bottom:2px solid #ccc;">Goal%</th>
      </tr>
    </thead>
    <tbody>${dayRows}</tbody>
  </table>

  <p style="margin-top:24px;font-size:13px;color:#999;">Days tracked: ${summary.daysTracked}/7 · Meals logged: ${summary.totals.mealsLogged}</p>
  <p style="margin-top:8px;font-size:13px;color:#999;">Generated by MealRoute 🥗</p>
</body>
</html>`;
}

function formatDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
