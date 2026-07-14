type AnalyzeRequest = {
  image?: string;
  answers?: string[];
  previousAnalysis?: unknown;
  review?: {
    ingredients?: { name?: string; amount?: string; calories?: number }[];
    cookingFat?: string;
    sauce?: string;
  };
};

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
        type: "object", additionalProperties: false, required: ["name", "amount", "calories", "protein", "carbs", "fat"],
        properties: {
          name: { type: "string" }, amount: { type: "string" }, calories: { type: "integer" },
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
    if (!body.image?.startsWith("data:image/")) {
      return Response.json({ error: "A valid meal image is required." }, { status: 400 });
    }
    if (body.image.length > 10_000_000) {
      return Response.json({ error: "This photo is too large. Please choose an image under 7 MB." }, { status: 413 });
    }

    const runtimeEnv = process.env as Record<string, string | undefined>;
    const apiKey = runtimeEnv.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Live AI analysis has not been securely connected yet." }, { status: 503 });
    }

    const isReview = Array.isArray(body.review?.ingredients);
    const isRefinement = !isReview && Array.isArray(body.answers) && body.answers.some(Boolean);
    const reviewedIngredients = isReview
      ? body.review!.ingredients!.slice(0, 20).map(item => ({
          name: String(item.name || "").slice(0, 100),
          amount: String(item.amount || "").slice(0, 100),
        })).filter(item => item.name)
      : [];
    const context = isReview
      ? `\nThis is the final user review. Previous analysis: ${JSON.stringify(body.previousAnalysis)}
User-confirmed foods and portions: ${JSON.stringify(reviewedIngredients)}
Cooking oil or butter: ${String(body.review?.cookingFat || "Keep current estimate").slice(0, 100)}
Sauce or dressing: ${String(body.review?.sauce || "Keep current estimate").slice(0, 100)}
Treat the reviewed food names and portions as authoritative. Recalculate every ingredient and all nutrition values from scratch. Include confirmed oil, butter, sauce, or dressing as separate ingredients. If the user selected "Keep current estimate", retain the relevant assumption from the previous analysis. If the user selected "Not sure", widen the calorie range instead of adding a large hidden serving. Return no clarifying questions.`
      : isRefinement
        ? `\nThis is a refinement. Previous analysis: ${JSON.stringify(body.previousAnalysis)}\nUser answers: ${body.answers!.map((answer, index) => `${index + 1}. ${String(answer).slice(0, 300)}`).join(" ")}\nUse the answers as authoritative details. Recalculate ingredient calories and totals, then return no further questions unless absolutely essential.`
        : "";

    const prompt = `Analyze this meal photograph for a calorie-tracking app. Identify only foods reasonably supported by the image; never substitute a canned meal or invent an ingredient as certain. Estimate each visible portion conservatively using familiar metric or household units, then calculate calories, protein, carbohydrates, and fat for every ingredient and for the complete meal. Do not assume restaurant-sized portions. Do not add oil, butter, dressing, or sauce as consumed unless it is visible or confirmed by the user; when it is uncertain, mention it and ask about it instead. The best calorie estimate must closely equal the sum of ingredient calories and must fall inside the low-to-high range. Total protein, carbs, and fat should closely equal the sums of the ingredient-level macros. Use a wider range when portion size is visually uncertain. Ask zero to two short clarifying questions only when an answer could materially improve the estimate, prioritizing portion size and hidden cooking fats or sauces. Nutrition values must be presented as estimates, not facts. If the image is not food or is too unclear, say so in mealName and notes, use Low confidence, and do not fabricate a meal.${context}`;

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: runtimeEnv.OPENAI_MODEL || "gpt-5.6",
        store: false,
        max_output_tokens: 1800,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: body.image, detail: "high" },
          ],
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
      ingredients: { calories: number; protein: number; carbs: number; fat: number }[];
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
