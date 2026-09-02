import type { SupabaseClient } from "@supabase/supabase-js";
import type { Micronutrients } from "./micronutrients";
import { EMPTY_MICRONUTRIENTS } from "./micronutrients";

export type RecipeIngredient = {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  micros?: Micronutrients;
};

export type Recipe = {
  id: string;
  name: string;
  description: string;
  servings: number;
  ingredients: RecipeIngredient[];
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  fibrePerServing: number;
  micros: Micronutrients;
  createdAt: string;
  updatedAt: string;
};

const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

const MICRO_COLUMNS = "micro_vitamin_a,micro_vitamin_c,micro_vitamin_d,micro_vitamin_e,micro_vitamin_k,micro_thiamin,micro_riboflavin,micro_niacin,micro_vitamin_b6,micro_folate,micro_vitamin_b12,micro_calcium,micro_iron,micro_magnesium,micro_potassium,micro_zinc,micro_sodium";

const SELECT_COLUMNS = `id,name,description,servings,ingredients,calories_per_serving,protein_per_serving,carbs_per_serving,fat_per_serving,fibre_per_serving,${MICRO_COLUMNS},created_at,updated_at`;

function parseMicrosFromRow(row: Record<string, unknown>): Micronutrients {
  return {
    vitaminA: numberValue(row.micro_vitamin_a),
    vitaminC: numberValue(row.micro_vitamin_c),
    vitaminD: numberValue(row.micro_vitamin_d),
    vitaminE: numberValue(row.micro_vitamin_e),
    vitaminK: numberValue(row.micro_vitamin_k),
    thiamin: numberValue(row.micro_thiamin),
    riboflavin: numberValue(row.micro_riboflavin),
    niacin: numberValue(row.micro_niacin),
    vitaminB6: numberValue(row.micro_vitamin_b6),
    folate: numberValue(row.micro_folate),
    vitaminB12: numberValue(row.micro_vitamin_b12),
    calcium: numberValue(row.micro_calcium),
    iron: numberValue(row.micro_iron),
    magnesium: numberValue(row.micro_magnesium),
    potassium: numberValue(row.micro_potassium),
    zinc: numberValue(row.micro_zinc),
    sodium: numberValue(row.micro_sodium),
  };
}

function normalizeIngredients(raw: unknown): RecipeIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      name: String(item?.name || "").trim().slice(0, 160),
      grams: numberValue(item?.grams),
      calories: numberValue(item?.calories),
      protein: numberValue(item?.protein),
      carbs: numberValue(item?.carbs),
      fat: numberValue(item?.fat),
      fibre: numberValue(item?.fibre),
      micros: item?.micros && typeof item.micros === "object" ? item.micros as Micronutrients : undefined,
    }))
    .filter(item => item.name && item.grams > 0);
}

function normalizeRecipe(row: Record<string, unknown>): Recipe {
  return {
    id: String(row.id || ""),
    name: String(row.name || "Untitled Recipe"),
    description: String(row.description || ""),
    servings: Math.max(1, Math.round(numberValue(row.servings) || 1)),
    ingredients: normalizeIngredients(row.ingredients),
    caloriesPerServing: numberValue(row.calories_per_serving),
    proteinPerServing: numberValue(row.protein_per_serving),
    carbsPerServing: numberValue(row.carbs_per_serving),
    fatPerServing: numberValue(row.fat_per_serving),
    fibrePerServing: numberValue(row.fibre_per_serving),
    micros: parseMicrosFromRow(row),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export async function loadRecipes(
  supabase: SupabaseClient,
  userId: string,
): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(row => normalizeRecipe(row));
}

export async function createRecipe(
  supabase: SupabaseClient,
  userId: string,
  recipe: {
    name: string;
    description: string;
    servings: number;
    ingredients: RecipeIngredient[];
    caloriesPerServing: number;
    proteinPerServing: number;
    carbsPerServing: number;
    fatPerServing: number;
    fibrePerServing: number;
    micros: Micronutrients;
  },
): Promise<Recipe> {
  const micros = recipe.micros || EMPTY_MICRONUTRIENTS;
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      user_id: userId,
      name: recipe.name.slice(0, 160),
      description: recipe.description.slice(0, 1000),
      servings: Math.max(1, Math.min(50, Math.round(recipe.servings))),
      ingredients: recipe.ingredients,
      calories_per_serving: round1(recipe.caloriesPerServing),
      protein_per_serving: round1(recipe.proteinPerServing),
      carbs_per_serving: round1(recipe.carbsPerServing),
      fat_per_serving: round1(recipe.fatPerServing),
      fibre_per_serving: round1(recipe.fibrePerServing),
      micro_vitamin_a: micros.vitaminA,
      micro_vitamin_c: micros.vitaminC,
      micro_vitamin_d: micros.vitaminD,
      micro_vitamin_e: micros.vitaminE,
      micro_vitamin_k: micros.vitaminK,
      micro_thiamin: micros.thiamin,
      micro_riboflavin: micros.riboflavin,
      micro_niacin: micros.niacin,
      micro_vitamin_b6: micros.vitaminB6,
      micro_folate: micros.folate,
      micro_vitamin_b12: micros.vitaminB12,
      micro_calcium: micros.calcium,
      micro_iron: micros.iron,
      micro_magnesium: micros.magnesium,
      micro_potassium: micros.potassium,
      micro_zinc: micros.zinc,
      micro_sodium: micros.sodium,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) throw error || new Error("The recipe could not be saved.");
  return normalizeRecipe(data);
}

export async function updateRecipe(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  recipe: {
    name: string;
    description: string;
    servings: number;
    ingredients: RecipeIngredient[];
    caloriesPerServing: number;
    proteinPerServing: number;
    carbsPerServing: number;
    fatPerServing: number;
    fibrePerServing: number;
    micros: Micronutrients;
  },
): Promise<Recipe> {
  const micros = recipe.micros || EMPTY_MICRONUTRIENTS;
  const { data, error } = await supabase
    .from("recipes")
    .update({
      name: recipe.name.slice(0, 160),
      description: recipe.description.slice(0, 1000),
      servings: Math.max(1, Math.min(50, Math.round(recipe.servings))),
      ingredients: recipe.ingredients,
      calories_per_serving: round1(recipe.caloriesPerServing),
      protein_per_serving: round1(recipe.proteinPerServing),
      carbs_per_serving: round1(recipe.carbsPerServing),
      fat_per_serving: round1(recipe.fatPerServing),
      fibre_per_serving: round1(recipe.fibrePerServing),
      micro_vitamin_a: micros.vitaminA,
      micro_vitamin_c: micros.vitaminC,
      micro_vitamin_d: micros.vitaminD,
      micro_vitamin_e: micros.vitaminE,
      micro_vitamin_k: micros.vitaminK,
      micro_thiamin: micros.thiamin,
      micro_riboflavin: micros.riboflavin,
      micro_niacin: micros.niacin,
      micro_vitamin_b6: micros.vitaminB6,
      micro_folate: micros.folate,
      micro_vitamin_b12: micros.vitaminB12,
      micro_calcium: micros.calcium,
      micro_iron: micros.iron,
      micro_magnesium: micros.magnesium,
      micro_potassium: micros.potassium,
      micro_zinc: micros.zinc,
      micro_sodium: micros.sodium,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipeId)
    .eq("user_id", userId)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) throw error || new Error("The recipe could not be updated.");
  return normalizeRecipe(data);
}

export async function deleteRecipe(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
): Promise<void> {
  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", recipeId)
    .eq("user_id", userId);

  if (error) throw error;
}

/**
 * Calculate per-serving nutrition from recipe ingredients.
 */
export function calculateRecipeNutrition(
  ingredients: RecipeIngredient[],
  servings: number,
) {
  const safeServings = Math.max(1, Math.min(50, Math.round(servings)));
  const totals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein: acc.protein + ing.protein,
      carbs: acc.carbs + ing.carbs,
      fat: acc.fat + ing.fat,
      fibre: acc.fibre + ing.fibre,
      micros: {
        vitaminA: acc.micros.vitaminA + (ing.micros?.vitaminA || 0),
        vitaminC: acc.micros.vitaminC + (ing.micros?.vitaminC || 0),
        vitaminD: acc.micros.vitaminD + (ing.micros?.vitaminD || 0),
        vitaminE: acc.micros.vitaminE + (ing.micros?.vitaminE || 0),
        vitaminK: acc.micros.vitaminK + (ing.micros?.vitaminK || 0),
        thiamin: acc.micros.thiamin + (ing.micros?.thiamin || 0),
        riboflavin: acc.micros.riboflavin + (ing.micros?.riboflavin || 0),
        niacin: acc.micros.niacin + (ing.micros?.niacin || 0),
        vitaminB6: acc.micros.vitaminB6 + (ing.micros?.vitaminB6 || 0),
        folate: acc.micros.folate + (ing.micros?.folate || 0),
        vitaminB12: acc.micros.vitaminB12 + (ing.micros?.vitaminB12 || 0),
        calcium: acc.micros.calcium + (ing.micros?.calcium || 0),
        iron: acc.micros.iron + (ing.micros?.iron || 0),
        magnesium: acc.micros.magnesium + (ing.micros?.magnesium || 0),
        potassium: acc.micros.potassium + (ing.micros?.potassium || 0),
        zinc: acc.micros.zinc + (ing.micros?.zinc || 0),
        sodium: acc.micros.sodium + (ing.micros?.sodium || 0),
      },
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fibre: 0,
      micros: { ...EMPTY_MICRONUTRIENTS },
    },
  );

  return {
    caloriesPerServing: Math.round(totals.calories / safeServings),
    proteinPerServing: round1(totals.protein / safeServings),
    carbsPerServing: round1(totals.carbs / safeServings),
    fatPerServing: round1(totals.fat / safeServings),
    fibrePerServing: round1(totals.fibre / safeServings),
    micros: {
      vitaminA: round1(totals.micros.vitaminA / safeServings),
      vitaminC: round1(totals.micros.vitaminC / safeServings),
      vitaminD: round1(totals.micros.vitaminD / safeServings),
      vitaminE: round1(totals.micros.vitaminE / safeServings),
      vitaminK: round1(totals.micros.vitaminK / safeServings),
      thiamin: round1(totals.micros.thiamin / safeServings),
      riboflavin: round1(totals.micros.riboflavin / safeServings),
      niacin: round1(totals.micros.niacin / safeServings),
      vitaminB6: round1(totals.micros.vitaminB6 / safeServings),
      folate: round1(totals.micros.folate / safeServings),
      vitaminB12: round1(totals.micros.vitaminB12 / safeServings),
      calcium: round1(totals.micros.calcium / safeServings),
      iron: round1(totals.micros.iron / safeServings),
      magnesium: round1(totals.micros.magnesium / safeServings),
      potassium: round1(totals.micros.potassium / safeServings),
      zinc: round1(totals.micros.zinc / safeServings),
      sodium: round1(totals.micros.sodium / safeServings),
    },
  };
}
