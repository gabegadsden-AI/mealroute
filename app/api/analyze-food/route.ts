type AnalyzeRequest = {
  image?: string;
  answers?: string[];
  previousAnalysis?: unknown;
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
        type: "object", additionalProperties: false, required: ["name", "amount", "calories"],
        properties: { name: { type: "string" }, amount: { type: "string" }, calories: { type: "integer" } },
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

    const isRefinement = Array.isArray(body.answers) && body.answers.some(Boolean);
    const context = isRefinement
      ? `\nThis is a refinement. Previous analysis: ${JSON.stringify(body.previousAnalysis)}\nUser answers: ${body.answers!.map((answer, index) => `${index + 1}. ${answer}`).join(" ")}\nUse the answers to improve the estimates and return no further questions unless absolutely essential.`
      : "";

    const prompt = `Analyze this meal photograph for a calorie-tracking app. Identify only foods reasonably supported by the image; never substitute a canned meal or invent an ingredient as certain. Estimate visible portions, calorie range, best calorie estimate, protein, carbohydrates, fat, fibre, and ingredient-level amounts. Consider hidden oil, butter, dressing, sauces, cooking method, and unclear serving sizes as uncertainty. Ask zero to two short clarifying questions only when an answer could materially improve the estimate. Nutrition values must be presented as estimates, not facts. If the image is not food or is too unclear, say so in mealName and notes, use Low confidence, and do not fabricate a meal.${context}`;

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: runtimeEnv.OPENAI_MODEL || "gpt-5.6",
        store: false,
        max_output_tokens: 1400,
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

    return Response.json({ analysis: JSON.parse(outputText) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
