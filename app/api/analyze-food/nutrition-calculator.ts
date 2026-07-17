import "server-only";

export type ConfirmedIngredient = {
  name: string;
  amountGrams: number;
};

export type CalculatedIngredient = ConfirmedIngredient & {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  nutritionSource: string;
  fdcId: number;
};

type Per100gFood = {
  fdcId: number;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type FdcFood = {
  fdcId?: number;
  description?: string;
  dataType?: string;
  foodNutrients?: Array<{ nutrientId?: number; value?: number; unitName?: string }>;
};

// Frequently corrected foods are pinned to specific USDA FoodData Central records.
// This also keeps common recalculations fast and available if the external API is busy.
const verifiedFoods: Array<Per100gFood & { matches: (name: string) => boolean }> = [
  {
    fdcId: 171477,
    description: "Chicken, breast, meat only, cooked, roasted",
    calories: 165,
    protein: 31.02,
    carbs: 0,
    fat: 3.57,
    matches: name => name.includes("chicken") && name.includes("breast") && !hasAny(name, ["raw", "uncooked", "skin on", "with skin"]),
  },
  {
    fdcId: 169704,
    description: "Rice, brown, long-grain, cooked",
    calories: 123,
    protein: 2.74,
    carbs: 25.58,
    fat: 0.97,
    matches: name => name.includes("brown rice") && !hasAny(name, ["raw", "dry", "uncooked"]),
  },
  {
    fdcId: 169976,
    description: "Cabbage, cooked, boiled, drained, without salt",
    calories: 23,
    protein: 1.27,
    carbs: 5.51,
    fat: 0.06,
    matches: name => name.includes("cabbage") && !name.includes("raw"),
  },
  {
    fdcId: 173944,
    description: "Bananas, raw",
    calories: 89,
    protein: 1.09,
    carbs: 22.84,
    fat: 0.33,
    matches: name => /\bbanana(s)?\b/.test(name) && !hasAny(name, ["fried", "dried", "chips"]),
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasAny(value: string, terms: string[]) {
  return terms.some(term => value.includes(term));
}

function roundMacro(value: number) {
  return Math.round(Math.max(0, value) * 10) / 10;
}

function nutrient(food: FdcFood, nutrientId: number) {
  const match = food.foodNutrients?.find(item => item.nutrientId === nutrientId);
  return Number(match?.value);
}

function toPer100g(food: FdcFood): Per100gFood | null {
  const fdcId = Number(food.fdcId);
  const description = String(food.description || "").trim();
  const calories = nutrient(food, 1008);
  const protein = nutrient(food, 1003);
  const carbs = nutrient(food, 1005);
  const fat = nutrient(food, 1004);
  if (!fdcId || !description || ![calories, protein, carbs, fat].every(Number.isFinite)) return null;
  return { fdcId, description, calories, protein, carbs, fat };
}

function matchScore(query: string, food: FdcFood) {
  const description = normalize(String(food.description || ""));
  const tokens = query.split(" ").filter(token => token.length > 2);
  let score = tokens.reduce((total, token) => total + (description.includes(token) ? 25 : -6), 0);

  const mismatches: Array<[string[], string[]]> = [
    [["cooked", "roasted", "grilled", "boiled"], ["raw", "uncooked"]],
    [["raw", "uncooked"], ["cooked", "roasted", "grilled", "boiled"]],
    [["brown"], ["white"]],
    [["skinless", "meat only"], ["with skin", "skin eaten"]],
    [["breast"], ["leg", "thigh", "wing"]],
  ];
  for (const [requested, conflicting] of mismatches) {
    if (hasAny(query, requested) && hasAny(description, conflicting)) score -= 1000;
  }
  if (food.dataType === "Foundation" || food.dataType === "SR Legacy") score += 20;
  if (food.dataType === "Survey (FNDDS)") score += 10;
  return score;
}

async function searchFoodDataCentral(name: string, apiKey: string): Promise<Per100gFood | null> {
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: name,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
      pageSize: 25,
      requireAllWords: false,
    }),
  });
  if (response.status === 429) {
    throw new Error("The USDA nutrition service has reached its request limit. Please wait and try again later.");
  }
  if (!response.ok) throw new Error("The USDA nutrition database is temporarily unavailable.");
  const payload = await response.json() as { foods?: FdcFood[] };
  const query = normalize(name);
  const candidates = (payload.foods || [])
    .map(food => ({ food, score: matchScore(query, food), values: toPer100g(food) }))
    .filter(candidate => candidate.values && candidate.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.values || null;
}

async function resolveFood(name: string, apiKey?: string): Promise<Per100gFood | null> {
  const normalizedName = normalize(name);
  const pinned = verifiedFoods.find(food => food.matches(normalizedName));
  if (pinned) return pinned;
  if (!apiKey) return null;
  return searchFoodDataCentral(name, apiKey);
}

export async function calculateVerifiedIngredients(confirmed: ConfirmedIngredient[], apiKey?: string) {
  const calculated: CalculatedIngredient[] = [];
  const unmatched: string[] = [];

  for (const ingredient of confirmed) {
    const food = await resolveFood(ingredient.name, apiKey);
    if (!food) {
      unmatched.push(ingredient.name);
      continue;
    }
    const multiplier = ingredient.amountGrams / 100;
    calculated.push({
      ...ingredient,
      calories: Math.round(food.calories * multiplier),
      protein: roundMacro(food.protein * multiplier),
      carbs: roundMacro(food.carbs * multiplier),
      fat: roundMacro(food.fat * multiplier),
      nutritionSource: `USDA FoodData Central · ${food.description}`,
      fdcId: food.fdcId,
    });
  }

  if (unmatched.length > 0) {
    const detail = unmatched.map(name => `“${name}”`).join(", ");
    throw new Error(apiKey
      ? `No confident USDA database match was found for ${detail}. Make the food name more specific, including cooked or raw.`
      : `A USDA_API_KEY is required to find USDA nutrition data for ${detail}. Add it in Vercel Environment Variables, then redeploy.`);
  }
  return calculated;
}
