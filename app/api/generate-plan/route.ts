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
          grams: { type: "integer", minimum: 10, maximum: 800, description: "Portion size in grams." },
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

    // Build the food palette — group by preferred slot so AI knows which foods go where
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

    // Build a slot → foods map for the prompt
    const slotMap: Record<string, string[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const food of palette) {
      const slots = food.preferredSlots?.length ? food.preferredSlots : ["breakfast", "lunch", "dinner", "snack"];
      for (const slot of slots) {
        if (slotMap[slot]) slotMap[slot].push(food.name);
      }
    }

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

FOODS GROUPED BY MEAL SLOT:
- Breakfast: ${slotMap.breakfast.join(", ") || "none assigned"}
- Lunch: ${slotMap.lunch.join(", ") || "none assigned"}
- Dinner: ${slotMap.dinner.join(", ") || "none assigned"}
- Snack: ${slotMap.snack.join(", ") || "none assigned"}

DATES TO PLAN: ${dates.join(", ")}

RULES:
1. Each day MUST have breakfast, lunch, dinner, and one snack.
2. For each meal slot, include MULTIPLE foods from the palette that are assigned to that slot. For example, if Oats, Eggs, and Banana are all assigned to breakfast, include all three as separate meal entries for that day's breakfast.
3. Each food item gets its own meal object with its own grams, calories, and macros.
4. Use ONLY foods from the palette. Do NOT invent foods or substitute.
5. Vary which foods appear each day, but always include the foods assigned to each slot.
6. If a slot has more than 3 foods assigned, pick 2-3 per day and rotate across days.
7. Size portions (in grams) so the daily total gets as close as possible to the calorie and macro targets.
8. Typical portion ranges: breakfast items 30-150g each, lunch items 50-250g each, dinner items 50-250g each, snack items 20-100g each. Adjust as needed to hit targets.
9. Calculate calories and macros for each meal based on the per-100g values and the gram amount. Use: calories = round(per100g.calories * grams / 100), etc.
10. The daily total should be within ±15% of the calorie target. Protein should be within ±20% of the protein target.
11. Return one meal object per food item per slot per day. Multiple foods in the same slot = multiple objects with the same date and slot.

Return JSON with this structure: { "meals": [ { "date": "YYYY-MM-DD", "slot": "breakfast", "foodName": "Oats", "grams": 80, "calories": 300, "protein": 10, "carbs": 55, "fat": 5 } ] }`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[generate-plan] OPENAI_API_KEY is not set");
      return Response.json({ error: "AI plan generation is not configured. Ask the admin to set the OpenAI API key." }, { status: 503 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o";
    console.log(`[generate-plan] Calling OpenAI model=${model}, days=${numDays}, palette=${palette.length} foods`);

    const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 6000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a precise nutrition planner. Always respond with valid JSON matching the requested schema.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error(`[generate-plan] OpenAI error ${apiResponse.status}: ${errorBody}`);
      let message = "The AI service could not generate a plan.";
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed?.error?.message) message = parsed.error.message;
      } catch {}
      return Response.json({ error: message }, { status: apiResponse.status });
    }

    const responseBody = await apiResponse.json() as any;
    const outputText = responseBody?.choices?.[0]?.message?.content;

    if (!outputText) {
      console.error("[generate-plan] No content in OpenAI response", JSON.stringify(responseBody).slice(0, 500));
      return Response.json({ error: "No plan was generated. Please try again." }, { status: 502 });
    }

    let plan: { meals: PlanMeal[] };
    try {
      plan = JSON.parse(outputText);
    } catch {
      console.error("[generate-plan] Failed to parse AI output as JSON");
      return Response.json({ error: "The AI returned an invalid response. Please try again." }, { status: 502 });
    }

    if (!plan.meals || !Array.isArray(plan.meals) || plan.meals.length === 0) {
      console.error("[generate-plan] No meals in parsed plan");
      return Response.json({ error: "The generated plan was empty. Try adding more foods to your palette." }, { status: 502 });
    }

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

    console.log(`[generate-plan] Success: ${plan.meals.length} meals across ${dailyTotals.length} days`);

    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[generate-plan] Unhandled error:", error);
    const message = error instanceof Error ? error.message : "Plan generation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
