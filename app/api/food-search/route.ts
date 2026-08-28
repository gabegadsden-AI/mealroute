import { searchFoodDataCentralFoods, type FoodSearchResult } from "../analyze-food/nutrition-calculator";
import { extractOFFMicronutrients } from "../../../lib/micronutrients";
import { createClient } from "../../../lib/supabase/server";

type SearchRequest = {
  query?: string;
};

const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

function normalizeForDedupe(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function searchOpenFoodFacts(query: string): Promise<FoodSearchResult[]> {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(query)}&fields=code,product_name,product_name_en,brands,nutriments,image_front_small_url&page_size=12`;
    const response = await fetch(url, {
      headers: { "User-Agent": "MealRoute/1.0 (web app)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];

    const data = (await response.json()) as any;
    const products = Array.isArray(data?.products) ? data.products : [];
    const results: FoodSearchResult[] = [];

    for (const prod of products) {
      const name = String(prod.product_name || prod.product_name_en || "").trim();
      if (!name) continue;
      const brandName = String(prod.brands || "").trim();
      const nutriments = prod.nutriments || {};

      const kcal = Number(nutriments["energy-kcal_100g"] ?? nutriments["energy-kcal"] ?? 0);
      const kj = Number(nutriments["energy_100g"] ?? nutriments["energy"] ?? 0);
      const caloriesPer100g = kcal > 0 ? kcal : kj > 0 ? kj / 4.184 : 0;
      const proteinPer100g = Number(nutriments.proteins_100g ?? 0);
      const carbsPer100g = Number(nutriments.carbohydrates_100g ?? 0);
      const fatPer100g = Number(nutriments.fat_100g ?? 0);
      const fibrePer100g = Number(nutriments.fiber_100g ?? nutriments.fibre_100g ?? 0);

      results.push({
        sourceKey: `off:${prod.code}`,
        sourceType: "off",
        name,
        brandName: brandName || undefined,
        caloriesPer100g: round1(caloriesPer100g),
        proteinPer100g: round1(proteinPer100g),
        carbsPer100g: round1(carbsPer100g),
        fatPer100g: round1(fatPer100g),
        fibrePer100g: round1(fibrePer100g),
        micros: extractOFFMicronutrients(nutriments),
        nutritionSource: `Open Food Facts · ${name}`,
        dataType: "Open Food Facts",
      });
    }
    return results;
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return Response.json({ error: "Sign in to search foods." }, { status: 401 });
    }

    const body = (await request.json()) as SearchRequest;
    const query = String(body.query || "").replace(/\s+/g, " ").trim();
    if (query.length < 2 || query.length > 80) {
      return Response.json({ error: "Enter between 2 and 80 characters." }, { status: 400 });
    }

    const apiKey = process.env.USDA_API_KEY;

    const [usdaFoods, offFoods] = await Promise.all([
      apiKey ? searchFoodDataCentralFoods(query, apiKey, 12).catch(() => [] as FoodSearchResult[]) : Promise.resolve([] as FoodSearchResult[]),
      searchOpenFoodFacts(query),
    ]);

    const seenNames = new Set<string>();
    const merged: FoodSearchResult[] = [];

    for (const food of [...usdaFoods, ...offFoods]) {
      const normKey = normalizeForDedupe(food.name);
      if (!normKey || seenNames.has(normKey)) continue;
      seenNames.add(normKey);
      merged.push(food);
    }

    return Response.json(
      { foods: merged },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Food search failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
