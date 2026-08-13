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

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["meals"],
  properties: {
    meals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "slot", "foodName", "grams", "calories", "protein", "carbs", "fat"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD format" },
          slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
          foodName: { type: "string", description: "Must match a food from the user's palette exactly." },
          grams: { type: "integer", minimum: 20, maximum: 800, description: "Portion size in grams." },
          calories: { type: "integer" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
        },
      },
    },
  },
} as const;

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

    // Load user profile (calorie + macro targets)
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

    if (!preferences || preferences.length < 3) {
      return Response.json({
        error: "Add at least 3 foods to your palette first so we can build a plan. Go to the Plan tab → My Foods."
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

    // Build the food palette for the AI prompt
    const palette = preferences.map((food: any) => ({
      name: food.food_name,
      per100g: {
        calories: Number(food.calories_per_100g) || 0,
        protein: Number(food.protein_per_100g) || 0,
        carbs: Number(food.carbs_per_100g) || 0,
        fat: Number(food.fat_per_100g) || 0,
      },
      preferredSlots: Array.isArray(food.preferred_slots) ? food.preferred_slots : ["breakfast", "lunch", "dinner", "snack"],
    }));

    const calorieGoal = Math.round(Number(profile.calorie_goal) || 2000);
    const proteinGoal = Math.round(Number(profile.protein_goal_g) || 0);
    const carbsGoal = Math.round(Number(profile.carbs_goal_g) || 0);
    const fatGoal = Math.round(Number(profile.fat_goal_g) || 0);

    const prompt = `You are a nutrition planner. Create a ${numDays}-day meal plan using ONLY the foods from the user's palette below.

USER TARGETS (per day):
- Calories: ${calorieGoal} kcal
- Protein: ${proteinGoal}g
- Carbs: ${carbsGoal}g
- Fat: ${fatGoal}g

USER FOOD PALETTE (use ONLY these foods):
${JSON.stringify(palette, null, 2)}

DATES TO PLAN: ${dates.join(", ")}

RULES:
1. Each day MUST have breakfast, lunch, dinner, and one snack (4 meals per day).
2. Use ONLY foods from the palette. Do NOT invent foods or substitute.
3. Vary the foods across days — avoid repeating the same meal more than 2 days in a row.
4. Respect each food's preferredSlots (a food listed for breakfast should appear in breakfast, etc.).
5. Size portions (in grams) so the daily total gets as close as possible to the calorie and macro targets.
6. Typical portion ranges: breakfast 200-500g, lunch 250-600g, dinner 250-600g, snack 50-200g. Adjust as needed to hit targets.
7. Calculate calories and macros for each meal based on the per-100g values and the gram amount. Use: calories = round(per100g.calories * grams / 100), etc.
8. The daily total should be within ±15% of the calorie target. Protein should be within ±20% of the protein target.
9. Return one meal object per slot per day. Every meal must have date, slot, foodName, grams, calories, protein, carbs, fat.

Return JSON matching the schema.`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "AI plan generation is not configured." }, { status: 503 });
    }

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6",
        store: false,
        max_output_tokens: 4000,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        text: { format: { type: "json_schema", name: "meal_plan", strict: true, schema: planSchema } },
      }),
    });

    const responseBody = await apiResponse.json() as any;
    if (!apiResponse.ok) {
      const message = responseBody?.error?.message || "The AI service could not generate a plan.";
      return Response.json({ error: message }, { status: apiResponse.status });
    }

    const outputText = responseBody.output
      ?.flatMap((item: any) => item.content || [])
      .find((item: any) => item.type === "output_text")?.text;

    if (!outputText) {
      return Response.json({ error: "No plan was generated. Please try again." }, { status: 502 });
    }

    const plan = JSON.parse(outputText) as { meals: PlanMeal[] };

    // Calculate daily totals
    const dailyTotalsMap = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
    for (const meal of plan.meals) {
      const existing = dailyTotalsMap.get(meal.date) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
      existing.calories += Math.round(meal.calories);
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

    const result: GeneratedPlan = { meals: plan.meals, dailyTotals };

    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan generation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
