import { searchFoodDataCentralFoods } from "../analyze-food/nutrition-calculator";
import { createClient } from "../../../lib/supabase/server";

type SearchRequest = {
  query?: string;
};

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
    if (!apiKey) {
      return Response.json({ error: "USDA food search is not configured." }, { status: 503 });
    }

    const foods = await searchFoodDataCentralFoods(query, apiKey, 12);
    return Response.json(
      { foods },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Food search failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
