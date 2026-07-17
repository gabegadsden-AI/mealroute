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
    ingredients?: { name?: string; amountGrams?: number; calories?: number; protein?: number; carbs?: number; fat?: number }[];
  };
};

function roundMacro(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 10) / 10) : 0;
}

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
    protein: { type: "number", description: "Estimated grams, rounded to one decimal place." },
    carbs: { type: "number", description: "Estimated grams, rounded to one decimal place." },
    fat: { type: "number", description: "Estimated grams, rounded to one decimal place." },
    fibre: { type: "number", description: "Estimated grams, rounded to one decimal place." },
    ingredients: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["name", "amountGrams", "calories", "protein", "carbs", "fat"],
        properties: {
          name: { type: "string" },
          amountGrams: { type: "integer", minimum: 1, maximum: 5000, description: "A single whole-number gram amount. Never include words such as about or approximately." },
          calories: { type: "integer" },
          protein: { type: "number", description: "Estimated grams for this ingredient, rounded to one decimal place." },
          carbs: { type: "number", description: "Estimated grams for this ingredient, rounded to one decimal place." },
          fat: { type: "number", description: "Estimated grams for this ingredient, rounded to one decimal place." },
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
    const apiKey = runtimeEnv.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Live AI analysis has not been securely connected yet." }, { status: 503 });
    }

    const isRefinement = !isReview && Array.isArray(body.answers) && body.answers.some(Boolean);
    const reviewedIngredients = isReview
      ? submittedReviewIngredients.slice(0, 20).map(item => ({
          name: String(item.name || "").slice(0, 100),
          amountGrams: Math.min(5000, Math.max(1, Math.round(Number(item.amountGrams) || 1))),
        })).filter(item => item.name)
      : [];
    if (isReview && reviewedIngredients.length === 0) {
      return Response.json({ error: "At least one confirmed ingredient and gram amount is required." }, { status: 400 });
    }

    const refinementContext = isRefinement
      ? `\nThis is a refinement. Previous analysis: ${JSON.stringify(body.previousAnalysis)}\nUser answers: ${body.answers!.map((answer, index) => `${index + 1}. ${String(answer).slice(0, 300)}`).join(" ")}\nUse the answers as authoritative details. Recalculate ingredient calories and totals, then return no further questions unless absolutely essential.`
      : "";
    const prompt = isReview
      ? `Recalculate nutrition from this locked, user-confirmed ingredient list: ${JSON.stringify(reviewedIngredients)}. This is a text-only calculation; do not analyze or reinterpret the meal photo, and ignore every previous calorie or macro total. Return exactly the same number of ingredients, in the same order, with the exact same names and amountGrams values. Never add, remove, rename, replace, split, or combine a food. Respect preparation details in each confirmed name, such as cooked, raw, skinless, or boneless. Do not add oil, sauce, butter, skin, bones, or another ingredient unless it appears explicitly in the confirmed list. Calculate calories, protein, carbohydrates, and fat for each confirmed gram amount using standard per-100-gram nutrition data and exact arithmetic. Round calories to whole numbers and macros to one decimal place. Set mealName to ${JSON.stringify(body.previousAnalysis?.mealName || "Confirmed meal")}. Make the meal totals equal the ingredient sums, return no uncertainties and no clarifying questions, and state in notes that nutrition was recalculated from the user's confirmed foods and grams.`
      : `Analyze this meal photograph for a calorie-tracking app. Identify only foods reasonably supported by the image; never substitute a canned meal or invent an ingredient as certain. Estimate each visible portion conservatively and return one whole-number amountGrams value for every ingredient. Display a single gram number such as 120, never a range and never words such as "about" or "approximately". Calculate calories, protein, carbohydrates, and fat for every ingredient and for the complete meal. Do not assume restaurant-sized portions. Do not add oil, butter, dressing, or sauce as consumed unless it is visible or confirmed by the user; when it is uncertain, mention it and ask about it instead. The best calorie estimate must closely equal the sum of ingredient calories and must fall inside the low-to-high range. Total protein, carbs, and fat should closely equal the sums of the ingredient-level macros. Use a wider calorie range when portion size is visually uncertain. Ask zero to two short clarifying questions only when an answer could materially improve the estimate, prioritizing portion size and hidden cooking fats or sauces. Nutrition values and image-derived gram amounts must be presented as estimates, not facts. If the image is not food or is too unclear, say so in mealName and notes, use Low confidence, and do not fabricate a meal.${refinementContext}`;

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: runtimeEnv.OPENAI_MODEL || "gpt-5.6",
        store: false,
        max_output_tokens: 1800,
        input: [{
          role: "user",
          content: isReview
            ? [{ type: "input_text", text: prompt }]
            : [{ type: "input_text", text: prompt }, { type: "input_image", image_url: body.image, detail: "high" }],
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
    if (isReview) {
      analysis.mealName = body.previousAnalysis?.mealName || analysis.mealName;
      analysis.ingredients = reviewedIngredients.map((confirmed, index) => {
        const calculated = analysis.ingredients[index] || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        return {
          name: confirmed.name,
          amountGrams: confirmed.amountGrams,
          calories: Math.max(0, Math.round(calculated.calories)),
          protein: roundMacro(calculated.protein),
          carbs: roundMacro(calculated.carbs),
          fat: roundMacro(calculated.fat),
        };
      });
      analysis.confidence = body.previousAnalysis?.confidence || analysis.confidence;
      analysis.uncertainties = [];
      analysis.clarifyingQuestions = [];
      analysis.notes = "Nutrition recalculated from your confirmed foods and exact gram amounts.";
    }
    const ingredientTotal = analysis.ingredients.reduce((sum, item) => sum + Math.max(0, Math.round(item.calories)), 0);
    const best = ingredientTotal > 0 ? ingredientTotal : Math.max(0, Math.round(analysis.calories.best));
    const originalLow = Math.max(0, Math.round(analysis.calories.low));
    const originalHigh = Math.max(0, Math.round(analysis.calories.high));
    analysis.calories.best = best;
    analysis.calories.low = isReview ? Math.max(0, Math.round(best * 0.95)) : Math.min(originalLow, originalHigh, best);
    analysis.calories.high = isReview ? Math.max(best, Math.round(best * 1.05)) : Math.max(originalLow, originalHigh, best);
    if (analysis.ingredients.length > 0) {
      analysis.protein = roundMacro(analysis.ingredients.reduce((sum, item) => sum + roundMacro(item.protein), 0));
      analysis.carbs = roundMacro(analysis.ingredients.reduce((sum, item) => sum + roundMacro(item.carbs), 0));
      analysis.fat = roundMacro(analysis.ingredients.reduce((sum, item) => sum + roundMacro(item.fat), 0));
    }

    return Response.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
