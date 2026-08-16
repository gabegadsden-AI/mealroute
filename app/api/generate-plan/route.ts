import { createClient } from "../../../lib/supabase/server";

type GeneratePlanRequest = {
  days?: number;
  startDate?: string;
};

type PlanMeal = {
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  foodName: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type GeneratedPlan = {
  meals: PlanMeal[];
  dailyTotals: { date: string; calories: number; protein: number; carbs: number; fat: number }[];
};

const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

// Calorie distribution across meal slots
const SLOT_CALORIE_SHARE: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.30,
  dinner: 0.30,
  snack: 0.15,
};

const SLOT_MIN_GRAMS: Record<string, number> = {
  breakfast: 30,
  lunch: 50,
  dinner: 50,
  snack: 20,
};

const SLOT_MAX_GRAMS: Record<string, number> = {
  breakfast: 300,
  lunch: 400,
  dinner: 400,
  snack: 200,
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return Response.json({ error: "Sign in to generate a meal plan." }, { status: 401 });
    }
    const userId = authData.user.id;

    const body = (await request.json()) as GeneratePlanRequest;
    const numDays = Math.min(7, Math.max(1, Math.round(Number(body.days) || 3)));
    const startDate = body.startDate && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)
      ? body.startDate
      : new Date().toISOString().slice(0, 10);

    // Load user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("calorie_goal,protein_goal_g,carbs_goal_g,fat_goal_g,primary_goal")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: "Complete onboarding first so we know your calorie target." }, { status: 400 });
    }

    // Load user food preferences (palette)
    const { data: preferences, error: prefError } = await supabase
      .from("food_preferences")
      .select("food_name,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fibre_per_100g,category,preferred_slots")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (prefError) throw prefError;

    if (!preferences || preferences.length < 1) {
      return Response.json({
        error: "Add at least 1 food to your palette first. Go to the Plan tab → My Foods."
      }, { status: 400 });
    }

    // Build date list
    const dates: string[] = [];
    const [sy, sm, sd] = startDate.split("-").map(Number);
    for (let i = 0; i < numDays; i++) {
      const d = new Date(sy, sm - 1, sd + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${day}`);
    }

    // Group foods by their assigned slots — respect user's choices exactly
    const foodsBySlot: Record<string, Array<{
      name: string;
      caloriesPer100g: number;
      proteinPer100g: number;
      carbsPer100g: number;
      fatPer100g: number;
    }>> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };

    for (const food of preferences as any[]) {
      const foodObj = {
        name: String(food.food_name || ""),
        caloriesPer100g: Number(food.calories_per_100g) || 0,
        proteinPer100g: Number(food.protein_per_100g) || 0,
        carbsPer100g: Number(food.carbs_per_100g) || 0,
        fatPer100g: Number(food.fat_per_100g) || 0,
      };
      const slots: string[] = Array.isArray(food.preferred_slots) && food.preferred_slots.length > 0
        ? food.preferred_slots
        : ["breakfast", "lunch", "dinner", "snack"];

      for (const slot of slots) {
        if (foodsBySlot[slot]) {
          foodsBySlot[slot].push(foodObj);
        }
      }
    }

    // Check that at least one slot has foods
    const totalFoods = Object.values(foodsBySlot).reduce((sum, arr) => sum + arr.length, 0);
    if (totalFoods === 0) {
      return Response.json({
        error: "No foods are assigned to any meal slots. Assign foods to Breakfast, Lunch, Dinner, or Snack first."
      }, { status: 400 });
    }

    const calorieGoal = Math.round(Number(profile.calorie_goal) || 2000);

    // Build the plan — deterministic, NO AI needed
    // For each day, for each slot, include ALL foods assigned to that slot
    // Portion sizes calculated to hit the slot's calorie share
    const allMeals: PlanMeal[] = [];

    for (const date of dates) {
      for (const slot of ["breakfast", "lunch", "dinner", "snack"]) {
        const slotFoods = foodsBySlot[slot];
        if (!slotFoods || slotFoods.length === 0) continue;

        // This slot gets SLOT_CALORIE_SHARE of the daily calorie target
        const slotCalories = Math.round(calorieGoal * SLOT_CALORIE_SHARE[slot]);

        // Split the slot's calories across all foods in this slot
        // Each food gets an equal share of the slot's calorie budget
        const caloriesPerFood = slotCalories / slotFoods.length;

        for (const food of slotFoods) {
          // Calculate grams: grams = (caloriesPerFood / caloriesPer100g) * 100
          let grams: number;
          if (food.caloriesPer100g > 0) {
            grams = Math.round((caloriesPerFood / food.caloriesPer100g) * 100);
          } else {
            grams = SLOT_MIN_GRAMS[slot] || 50;
          }

          // Clamp to reasonable ranges
          const minG = SLOT_MIN_GRAMS[slot] || 30;
          const maxG = SLOT_MAX_GRAMS[slot] || 300;
          grams = Math.max(minG, Math.min(maxG, grams));

          // Round to nearest 5g
          grams = Math.round(grams / 5) * 5;

          // Calculate actual calories and macros from grams
          const calories = Math.round((food.caloriesPer100g * grams) / 100);
          const protein = round1((food.proteinPer100g * grams) / 100);
          const carbs = round1((food.carbsPer100g * grams) / 100);
          const fat = round1((food.fatPer100g * grams) / 100);

          allMeals.push({
            date,
            slot: slot as "breakfast" | "lunch" | "dinner" | "snack",
            foodName: food.name,
            grams,
            calories,
            protein,
            carbs,
            fat,
          });
        }
      }
    }

    // Calculate daily totals
    const dailyTotalsMap = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
    for (const meal of allMeals) {
      const existing = dailyTotalsMap.get(meal.date) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
      existing.calories += meal.calories;
      existing.protein = round1(existing.protein + meal.protein);
      existing.carbs = round1(existing.carbs + meal.carbs);
      existing.fat = round1(existing.fat + meal.fat);
      dailyTotalsMap.set(meal.date, existing);
    }

    const dailyTotals = Array.from(dailyTotalsMap.entries()).map(([date, totals]) => ({
      date,
      calories: Math.round(totals.calories),
      protein: round1(totals.protein),
      carbs: round1(totals.carbs),
      fat: round1(totals.fat),
    }));

    const result: GeneratedPlan = { meals: allMeals, dailyTotals };

    console.log(`[generate-plan] Success: ${allMeals.length} meals across ${dailyTotals.length} days, ${totalFoods} foods in palette`);

    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[generate-plan] Unhandled error:", error);
    const message = error instanceof Error ? error.message : "Plan generation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
