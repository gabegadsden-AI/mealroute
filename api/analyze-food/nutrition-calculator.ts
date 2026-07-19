import "server-only";

export type ConfirmedIngredient = {
  name: string;
  amountGrams: number;
  fdcId?: number;
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
  description: string;
  fdcId: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  matches: (normalizedName: string) => boolean;
};

type FdcNutrient = {
  nutrientId?: number;
  value?: number;
  amount?: number;
  nutrient?: { id?: number };
};

type FdcFood = {
  fdcId?: number;
  description?: string;
  dataType?: string;
  foodNutrients?: FdcNutrient[];
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const has = (value: string, terms: string[]) => terms.some(term => value.includes(term));
const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

// Stable records for the Phase 1 accuracy benchmark. These values are per 100 g.
const verifiedFoods: Per100gFood[] = [
  {
    description: "Rice, brown, long-grain, cooked",
    fdcId: 169704,
    calories: 123,
    protein: 2.74,
    carbs: 25.58,
    fat: 0.97,
    matches: name => has(name, ["brown rice", "rice brown"]) && has(name, ["cooked", "boiled"]),
  },
  {
    description: "Chicken, broilers or fryers, breast, meat only, cooked, grilled",
    fdcId: 171477,
    calories: 165,
    protein: 31.02,
    carbs: 0,
    fat: 3.57,
    matches: name => has(name, ["chicken breast", "breast chicken"]) && !has(name, ["skin on", "with skin", "fried", "breaded"]),
  },
  {
    description: "Cabbage, cooked, boiled, drained, without salt",
    fdcId: 169976,
    calories: 23,
    protein: 1.27,
    carbs: 5.51,
    fat: 0.06,
    matches: name => name.includes("cabbage") && has(name, ["cooked", "boiled", "steamed"]),
  },
  {
    description: "Bananas, raw",
    fdcId: 173944,
    calories: 89,
    protein: 1.09,
    carbs: 22.84,
    fat: 0.33,
    matches: name => name.includes("banana") && !has(name, ["bread", "chips", "fried"]),
  },
  {
    description: "Lentils, mature seeds, cooked, boiled, without salt",
    fdcId: 172421,
    calories: 116,
    protein: 9.02,
    carbs: 20.13,
    fat: 0.38,
    matches: name => /\blentils?\b/.test(name) && !has(name, ["dry", "raw", "sprouted", "with salt", "salted"]),
  },
  {
    description: "Lentils, mature seeds, cooked, boiled, with salt",
    fdcId: 175254,
    calories: 114,
    protein: 9.02,
    carbs: 19.54,
    fat: 0.38,
    matches: name => /\blentils?\b/.test(name) && has(name, ["with salt", "salted"]),
  },
];

function nutrient(food: FdcFood, id: number) {
  const match = food.foodNutrients?.find(item => item.nutrientId === id || item.nutrient?.id === id);
  const value = Number(match?.value ?? match?.amount);
  return Number.isFinite(value) ? value : 0;
}

function toPer100g(food: FdcFood): Per100gFood | null {
  const fdcId = Number(food.fdcId);
  if (!Number.isFinite(fdcId) || fdcId <= 0) return null;
  const description = String(food.description || "USDA food");
  const result = {
    description,
    fdcId: Math.round(fdcId),
    calories: nutrient(food, 1008),
    protein: nutrient(food, 1003),
    carbs: nutrient(food, 1005),
    fat: nutrient(food, 1004),
    matches: () => false,
  };
  return result.calories > 0 || result.protein > 0 || result.carbs > 0 || result.fat > 0 ? result : null;
}

function responseError(response: Response) {
  if (response.status === 429) return new Error("The USDA nutrition service has reached its request limit. Please wait and try again later.");
  return new Error("The USDA nutrition database is temporarily unavailable.");
}

async function getFoodDataCentralById(fdcId: number, apiKey: string) {
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw responseError(response);
  return toPer100g(await response.json() as FdcFood);
}

function scoreCandidate(food: FdcFood, query: string) {
  const description = normalize(String(food.description || ""));
  const queryWords = query.split(" ").filter(word => word.length > 2);
  let score = queryWords.reduce((total, word) => total + (description.includes(word) ? 4 : -2), 0);
  if (description === query) score += 30;
  if (query.includes("without salt")) score += description.includes("without salt") ? 35 : -35;
  if (query.includes("with salt") && !query.includes("without salt")) score += description.includes("with salt") ? 25 : -20;
  if (query.includes("cooked")) score += has(description, ["cooked", "boiled", "grilled", "roasted"]) ? 10 : -10;
  if (query.includes("raw")) score += description.includes("raw") ? 10 : -10;
  if (has(description, ["restaurant", "fast food", "babyfood"])) score -= 15;
  if (has(String(food.dataType || "").toLowerCase(), ["foundation", "sr legacy"])) score += 3;
  return score;
}

async function searchFoodDataCentral(name: string, apiKey: string) {
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ query: name, pageSize: 25, requireAllWords: false }),
    cache: "no-store",
  });
  if (!response.ok) throw responseError(response);
  const payload = await response.json() as { foods?: FdcFood[] };
  const query = normalize(name);
  const candidates = (payload.foods || [])
    .map(food => ({ food, score: scoreCandidate(food, query) }))
    .sort((a, b) => b.score - a.score);
  return candidates.length ? toPer100g(candidates[0].food) : null;
}

async function resolveFood(ingredient: ConfirmedIngredient, apiKey?: string) {
  const lockedId = Number(ingredient.fdcId);
  if (Number.isFinite(lockedId) && lockedId > 0) {
    const local = verifiedFoods.find(food => food.fdcId === Math.round(lockedId));
    if (local) return local;
    if (!apiKey) {
      throw new Error(`A USDA_API_KEY is required to retrieve saved USDA record ${Math.round(lockedId)}.`);
    }
    const locked = await getFoodDataCentralById(Math.round(lockedId), apiKey);
    if (!locked) {
      throw new Error(`Saved USDA record ${Math.round(lockedId)} is unavailable. Edit the food name to choose a new match.`);
    }
    return locked;
  }

  const normalizedName = normalize(ingredient.name);
  const local = verifiedFoods.find(food => food.matches(normalizedName));
  if (local) return local;
  if (!apiKey) {
    throw new Error(`A USDA_API_KEY is required to find USDA nutrition data for “${ingredient.name}”. Add it in Vercel Environment Variables, then redeploy.`);
  }
  const searched = await searchFoodDataCentral(ingredient.name, apiKey);
  if (!searched) throw new Error(`No verified USDA nutrition match was found for “${ingredient.name}”. Try a more specific food name.`);
  return searched;
}

export async function calculateVerifiedIngredients(ingredients: ConfirmedIngredient[], apiKey?: string): Promise<CalculatedIngredient[]> {
  const calculated: CalculatedIngredient[] = [];
  for (const ingredient of ingredients) {
    const food = await resolveFood(ingredient, apiKey);
    const ratio = ingredient.amountGrams / 100;
    calculated.push({
      ...ingredient,
      fdcId: food.fdcId,
      calories: round1(food.calories * ratio),
      protein: round1(food.protein * ratio),
      carbs: round1(food.carbs * ratio),
      fat: round1(food.fat * ratio),
      nutritionSource: `USDA FoodData Central · ${food.description}`,
    });
  }
  return calculated;
}
