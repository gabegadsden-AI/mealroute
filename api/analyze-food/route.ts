import { calculateVerifiedIngredients } from "./nutrition-calculator";
import { createClient } from "../../../lib/supabase/server";

type AnalyzeRequest = {
  image?: string;
  mode?: "analyze" | "review";
  answers?: string[];
  previousAnalysis?: {
    mealName?: string;
    confidence?: "High" | "Medium" | "Low";
    notes?: string;
  };
  review?: {
    ingredients?: {
      name?: string; amountGrams?: number; calories?: number; protein?: number; carbs?: number; fat?: number; fibre?: number; fdcId?: number;
      labelNutrition?: { productName?: string; energyValue?: number; energyUnit?: "kcal" | "kJ"; carbs?: number; protein?: number; fat?: number; fibre?: number };
    }[];
  };
};

const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["mealName", "calories", "protein", "carbs", "fat", "fibre", "ingredients", "confidence", "uncertainties", "clarifyingQuestions", "notes"],
  properties: {
    mealName: { type: "string", description: "A concise name based only on foods visible in the image." },
    calories: {
      type: "object", additionalProperties: false, required: ["low", "high", "best"],
      properties: { low: { type: "integer" }, high: { type: "integer" }, best: { type: "integer" } },
    },
    protein: { type: "integer", description: "Estimated grams." },
    carbs: { type: "integer", description: "Estimated grams." },
    fat: { type: "integer", description: "Estimated grams." },
    fibre: { type: "integer", description: "Estimated grams." },
    ingredients: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["name", "amountGrams", "calories", "protein", "carbs", "fat"],
        properties: {
          name: { type: "string" },
          amountGrams: { type: "integer", minimum: 1, maximum: 5000, description: "A single whole-number gram amount. Never include words such as about or approximately." },
          calories: { type: "integer" },
          protein: { type: "integer", description: "Estimated grams for this ingredient." },
          carbs: { type: "integer", description: "Estimated grams for this ingredient." },
          fat: { type: "integer", description: "Estimated grams for this ingredient." },
        },
      },
    },
    confidence: { type: "string", enum: ["High", "Medium", "Low"] },
    uncertainties: { type: "array", items: { type: "string" }, maxItems: 3 },
    clarifyingQuestions: { type: "array", items: { type: "string" }, maxItems: 2 },
    notes: { type: "string" },
  },
} as const;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return Response.json({ error: "Sign in to analyze meals." }, { status: 401 });
    }
    const body = (await request.json()) as AnalyzeRequest;
    const submittedReviewIngredients = Array.isArray(body.review?.ingredients) ? body.review.ingredients : [];
    const isReview = body.mode === "review" || submittedReviewIngredients.length > 0;
    if (!isReview && !body.image?.startsWith("data:image/")) {
      return Response.json({ error: "A valid meal image is required." }, { status: 400 });
    }
    if (!isReview && body.image!.length > 10_000_000) {
      return Response.json({ error: "This photo is too large. Please choose an image under 7 MB." }, { status: 413 });
    }

    const runtimeEnv = process.env as Record<string, string | undefined>;
    const reviewedIngredients = isReview
      ? submittedReviewIngredients.slice(0, 20).map(item => {
          const label = item.labelNutrition;
          const labelValues = label ? [label.energyValue, label.carbs, label.protein, label.fat, label.fibre].map(Number) : [];
          const validLabel = Boolean(label && Number(label.energyValue) > 0 && labelValues.every(value => Number.isFinite(value) && value >= 0));
          return {
            name: String(item.name || "").slice(0, 100),
            amountGrams: Math.min(5000, Math.max(1, Math.round(Number(item.amountGrams) || 1))),
            fdcId: validLabel ? undefined : Number.isFinite(Number(item.fdcId)) && Number(item.fdcId) > 0 ? Math.round(Number(item.fdcId)) : undefined,
            labelNutrition: validLabel ? {
              productName: String(label?.productName || item.name || "Packaged food").slice(0, 120),
              energyValue: Number(label?.energyValue),
              energyUnit: label?.energyUnit === "kJ" ? "kJ" as const : "kcal" as const,
              carbs: Number(label?.carbs),
              protein: Number(label?.protein),
              fat: Number(label?.fat),
              fibre: Number(label?.fibre),
            } : undefined,
          };
        }).filter(item => item.name)
      : [];
    if (isReview && reviewedIngredients.length === 0) {
      return Response.json({ error: "At least one confirmed ingredient and gram amount is required." }, { status: 400 });
    }

    if (isReview) {
      const ingredients = await calculateVerifiedIngredients(reviewedIngredients, runtimeEnv.USDA_API_KEY);
      const calories = Math.round(ingredients.reduce((sum, item) => sum + item.calories, 0));
      const protein = round1(ingredients.reduce((sum, item) => sum + item.protein, 0));
      const carbs = round1(ingredients.reduce((sum, item) => sum + item.carbs, 0));
      const fat = round1(ingredients.reduce((sum, item) => sum + item.fat, 0));
      const fibre = round1(ingredients.reduce((sum, item) => sum + item.fibre, 0));
      const sourceKinds = new Set(ingredients.map(item => item.calculationSource));
      const calculationMethod = sourceKinds.size > 1 ? "mixed_sources" : sourceKinds.has("nutrition_label") ? "nutrition_label" : "verified_database";
      return Response.json({ analysis: {
        mealName: body.previousAnalysis?.mealName || "Confirmed meal",
        calories: { low: calories, high: calories, best: calories }, protein, carbs, fat, fibre, ingredients,
        confidence: body.previousAnalysis?.confidence || "High", uncertainties: [], clarifyingQuestions: [],
        notes: "Nutrition calculated from your confirmed foods, exact gram amounts, and the displayed source for each ingredient.",
        calculationMethod,
      }});
    }

    const apiKey = runtimeEnv.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ error: "Live AI analysis has not been securely connected yet." }, { status: 503 });

    const isRefinement = Array.isArray(body.answers) && body.answers.some(Boolean);

    const refinementContext = isRefinement
      ? `\nThis is a refinement. Previous analysis: ${JSON.stringify(body.previousAnalysis)}\nUser answers: ${body.answers!.map((answer, index) => `${index + 1}. ${String(answer).slice(0, 300)}`).join(" ")}\nUse the answers as authoritative details. Recalculate ingredient calories and totals, then return no further questions unless absolutely essential.`
      : "";
    const prompt = `Analyze this meal photograph for a calorie-tracking app. Identify only foods reasonably supported by the image; never substitute a canned meal or invent an ingredient as certain. Estimate each visible portion conservatively and return one whole-number amountGrams value for every ingredient. Display a single gram number such as 120, never a range and never words such as "about" or "approximately". Calculate calories, protein, carbohydrates, and fat for every ingredient and for the complete meal. Do not assume restaurant-sized portions. Do not add oil, butter, dressing, or sauce as consumed unless it is visible or confirmed by the user; when it is uncertain, mention it and ask about it instead. The best calorie estimate must closely equal the sum of ingredient calories and must fall inside the low-to-high range. Total protein, carbs, and fat should closely equal the sums of the ingredient-level macros. Use a wider calorie range when portion size is visually uncertain. Ask zero to two short clarifying questions only when an answer could materially improve the estimate, prioritizing portion size and hidden cooking fats or sauces. Nutrition values and image-derived gram amounts must be presented as estimates, not facts. If the image is not food or is too unclear, say so in mealName and notes, use Low confidence, and do not fabricate a meal.${refinementContext}`;

    // ─── OpenAI Chat Completions API (corrected) ───────────────────────
    // Previous code used /v1/responses (non-existent), gpt-5.6 (invalid model),
    // input/input_text/input_image (wrong payload format), and output/output_text
    // (wrong response parsing). This uses the standard Chat Completions API.
    const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: runtimeEnv.OPENAI_MODEL || "gpt-4o",
        max_tokens: 1800,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: body.image, detail: "high" } },
          ],
        }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "food_analysis",
            strict: true,
            schema,
          },
        },
      }),
    });

    const responseBody = await apiResponse.json() as any;
    if (!apiResponse.ok) {
      const message = responseBody?.error?.message || "The AI service could not analyze this image.";
      return Response.json({ error: message }, { status: apiResponse.status });
    }

    // Chat Completions returns { choices: [{ message: { content: "..." } }] }
    const outputText = responseBody.choices?.[0]?.message?.content;
    if (!outputText) {
      return Response.json({ error: "No food analysis was returned. Please try another photo." }, { status: 502 });
    }

    const analysis = JSON.parse(outputText) as {
      calories: { low: number; high: number; best: number };
      protein: number;
      carbs: number;
      fat: number;
      mealName: string;
      confidence: "High" | "Medium" | "Low";
      uncertainties: string[];
      clarifyingQuestions: string[];
      notes: string;
      ingredients: { name: string; amountGrams: number; calories: number; protein: number; carbs: number; fat: number }[];
    };
    const ingredientTotal = analysis.ingredients.reduce((sum, item) => sum + Math.max(0, Math.round(item.calories)), 0);
    const best = ingredientTotal > 0 ? ingredientTotal : Math.max(0, Math.round(analysis.calories.best));
    const originalLow = Math.max(0, Math.round(analysis.calories.low));
    const originalHigh = Math.max(0, Math.round(analysis.calories.high));
    analysis.calories.best = best;
    analysis.calories.low = Math.min(originalLow, originalHigh, best);
    analysis.calories.high = Math.max(originalLow, originalHigh, best);
    if (analysis.ingredients.length > 0) {
      analysis.protein = analysis.ingredients.reduce((sum, item) => sum + Math.max(0, Math.round(item.protein)), 0);
      analysis.carbs = analysis.ingredients.reduce((sum, item) => sum + Math.max(0, Math.round(item.carbs)), 0);
      analysis.fat = analysis.ingredients.reduce((sum, item) => sum + Math.max(0, Math.round(item.fat)), 0);
    }

    return Response.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
