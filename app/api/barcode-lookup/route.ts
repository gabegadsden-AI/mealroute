import { createClient } from "../../../lib/supabase/server";

type BarcodeLookupResponse = {
  found: boolean;
  productName?: string;
  brandName?: string;
  imageUrl?: string;
  energyValue?: number;   // per 100g
  energyUnit?: "kcal" | "kJ";
  carbs?: number;          // per 100g
  protein?: number;        // per 100g
  fat?: number;            // per 100g
  fibre?: number;          // per 100g
  source?: string;
  error?: string;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function POST(request: Request) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return Response.json({ error: "Sign in to scan barcodes." }, { status: 401 });
    }

    const body = (await request.json()) as { barcode?: string };
    const barcode = String(body.barcode || "").replace(/\D/g, "");

    if (barcode.length < 6 || barcode.length > 14) {
      return Response.json({ error: "Enter a valid barcode (6–14 digits)." }, { status: 400 });
    }

    // Open Food Facts — free, no API key required
    const fields = [
      "product_name",
      "product_name_en",
      "brands",
      "image_front_url",
      "image_front_small_url",
      "nutriments",
    ].join(",");

    const offUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`;
    const offRes = await fetch(offUrl, {
      headers: { "User-Agent": "MealRoute/1.0 (web app)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!offRes.ok) {
      return Response.json({ found: false, error: "Lookup service unavailable." } satisfies BarcodeLookupResponse, { status: 502 });
    }

    const offData = await offRes.json() as any;

    // Not found or no nutrition data
    if (offData.status !== 1 || !offData.product) {
      return Response.json({
        found: false,
        productName: undefined,
      } satisfies BarcodeLookupResponse);
    }

    const product = offData.product;
    const nutriments = product.nutriments || {};

    const productName = String(product.product_name || product.product_name_en || "").trim();
    const brandName = String(product.brands || "").trim();

    // Open Food Facts stores energy in kJ by default; some products also have kcal
    const energyKcal = num(nutriments["energy-kcal_100g"] ?? nutriments["energy-kcal"] ?? 0);
    const energyKj = num(nutriments["energy_100g"] ?? nutriments["energy"] ?? 0);

    // Prefer kcal if available; convert from kJ if not
    let energyValue: number;
    let energyUnit: "kcal" | "kJ";

    if (energyKcal > 0) {
      energyValue = Math.round(energyKcal * 10) / 10;
      energyUnit = "kcal";
    } else if (energyKj > 0) {
      energyValue = Math.round(energyKj * 10) / 10;
      energyUnit = "kJ";
    } else {
      // No energy data — return found but flag missing nutrition
      return Response.json({
        found: true,
        productName: productName || "Unknown product",
        brandName: brandName || undefined,
        imageUrl: product.image_front_url || product.image_front_small_url || undefined,
        energyValue: 0,
        energyUnit: "kcal",
        carbs: num(nutriments.carbohydrates_100g ?? 0),
        protein: num(nutriments.proteins_100g ?? 0),
        fat: num(nutriments.fat_100g ?? 0),
        fibre: num(nutriments.fiber_100g ?? nutriments.fibre_100g ?? 0),
        source: "Open Food Facts",
        error: "No calorie data on Open Food Facts — please enter the values from the package label.",
      } satisfies BarcodeLookupResponse);
    }

    return Response.json({
      found: true,
      productName: productName || "Unknown product",
      brandName: brandName || undefined,
      imageUrl: product.image_front_url || product.image_front_small_url || undefined,
      energyValue,
      energyUnit,
      carbs: Math.round(num(nutriments.carbohydrates_100g ?? 0) * 10) / 10,
      protein: Math.round(num(nutriments.proteins_100g ?? 0) * 10) / 10,
      fat: Math.round(num(nutriments.fat_100g ?? 0) * 10) / 10,
      fibre: Math.round(num(nutriments.fiber_100g ?? nutriments.fibre_100g ?? 0) * 10) / 10,
      source: "Open Food Facts",
    } satisfies BarcodeLookupResponse, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Barcode lookup failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
