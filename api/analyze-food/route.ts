import { calculateVerifiedIngredients } from "./nutrition-calculator";

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
    ingredients?: { name?: string; amountGrams?: number; calories?: number; protein?: number; carbs?: number; fat?: number; fdcId?: number }[];
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
      ? submittedReviewIngredients.slice(0, 20).map(item => ({
          name: String(item.name || "").slice(0, 100),
          amountGrams: Math.min(5000, Math.max(1, Math.round(Number(item.amountGrams) || 1))),
          fdcId: Number.isFinite(Number(item.fdcId)) && Number(item.fdcId) > 0 ? Math.round(Number(item.fdcId)) : undefined,
        })).filter(item => item.name)
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
      return Response.json({
        analysis: {
          mealName: body.previousAnalysis?.mealName || "Confirmed meal",
          calories: { low: calories, high: calories, best: calories },
          protein,
          carbs,
          fat,
          fibre: 0,
          ingredients,
          confidence: body.previousAnalysis?.confidence || "High",
          uncertainties: [],
          clarifyingQuestions: [],
          notes: "Nutrition calculated from your confirmed foods, exact gram amounts, and the displayed USDA FoodData Central records.",
          calculationMethod: "verified_database",
        },
      });
    }

    const apiKey = runtimeEnv.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Live AI analysis has not been securely connected yet." }, { status: 503 });
    }

    const isRefinement = Array.isArray(body.answers) && body.answers.some(Boolean);

    const refinementContext = isRefinement
      ? `\nThis is a refinement. Previous analysis: ${JSON.stringify(body.previousAnalysis)}\nUser answers: ${body.answers!.map((answer, index) => `${index + 1}. ${String(answer).slice(0, 300)}`).join(" ")}\nUse the answers as authoritative details. Recalculate ingredient calories and totals, then return no further questions unless absolutely essential.`
      : "";
    const prompt = `Analyze this meal photograph for a calorie-tracking app. Identify only foods reasonably supported by the image; never substitute a canned meal or invent an ingredient as certain. Estimate each visible portion conservatively and return one whole-number amountGrams value for every ingredient. Display a single gram number such as 120, never a range and never words such as "about" or "approximately". Calculate calories, protein, carbohydrates, and fat for every ingredient and for the complete meal. Do not assume restaurant-sized portions. Do not add oil, butter, dressing, or sauce as consumed unless it is visible or confirmed by the user; when it is uncertain, mention it and ask about it instead. The best calorie estimate must closely equal the sum of ingredient calories and must fall inside the low-to-high range. Total protein, carbs, and fat should closely equal the sums of the ingredient-level macros. Use a wider calorie range when portion size is visually uncertain. Ask zero to two short clarifying questions only when an answer could materially improve the estimate, prioritizing portion size and hidden cooking fats or sauces. Nutrition values and image-derived gram amounts must be presented as estimates, not facts. If the image is not food or is too unclear, say so in mealName and notes, use Low confidence, and do not fabricate a meal.${refinementContext}`;

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: runtimeEnv.OPENAI_MODEL || "gpt-5.6",
        store: false,
        max_output_tokens: 1800,
        input: [{
          role: "user",
          content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: body.image, detail: "high" }],
        }],
        text: { format: { type: "json_schema", name: "food_analysis", strict: true, schema } },
      }),
    });

    const responseBody = await apiResponse.json() as any;
    if (!apiResponse.ok) {
      const message = responseBody?.error?.message || "The AI service could not analyze this image.";
      return Response.json({ error: message }, { status: apiResponse.status });
    }

    const outputText = responseBody.output
      ?.flatMap((item: any) => item.content || [])
      .find((item: any) => item.type === "output_text")?.text;
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
