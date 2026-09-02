import { createClient } from "../../../lib/supabase/server";
import {
  loadRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  calculateRecipeNutrition,
  type RecipeIngredient,
} from "../../../lib/recipes";

type CreateRequest = {
  name?: string;
  description?: string;
  servings?: number;
  ingredients?: RecipeIngredient[];
};

type UpdateRequest = CreateRequest & { recipeId?: string };

type DeleteRequest = { recipeId?: string };

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return Response.json({ error: "Sign in to view your recipes." }, { status: 401 });
    }

    const recipes = await loadRecipes(supabase, data.user.id);
    return Response.json({ recipes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load recipes.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return Response.json({ error: "Sign in to create recipes." }, { status: 401 });
    }

    const body = (await request.json()) as CreateRequest;
    const name = String(body.name || "").trim();
    if (!name || name.length < 2) {
      return Response.json({ error: "Recipe name must be at least 2 characters." }, { status: 400 });
    }

    const servings = Math.max(1, Math.min(50, Math.round(Number(body.servings) || 1)));
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients.filter(ing => ing.name && ing.grams > 0) : [];

    if (!ingredients.length) {
      return Response.json({ error: "Add at least one ingredient to your recipe." }, { status: 400 });
    }

    const nutrition = calculateRecipeNutrition(ingredients, servings);

    const recipe = await createRecipe(supabase, data.user.id, {
      name,
      description: String(body.description || "").trim(),
      servings,
      ingredients,
      ...nutrition,
    });

    return Response.json({ recipe }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create recipe.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return Response.json({ error: "Sign in to update recipes." }, { status: 401 });
    }

    const body = (await request.json()) as UpdateRequest;
    const recipeId = String(body.recipeId || "");
    if (!recipeId) {
      return Response.json({ error: "Recipe ID is required." }, { status: 400 });
    }

    const name = String(body.name || "").trim();
    if (!name || name.length < 2) {
      return Response.json({ error: "Recipe name must be at least 2 characters." }, { status: 400 });
    }

    const servings = Math.max(1, Math.min(50, Math.round(Number(body.servings) || 1)));
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients.filter(ing => ing.name && ing.grams > 0) : [];

    if (!ingredients.length) {
      return Response.json({ error: "Add at least one ingredient to your recipe." }, { status: 400 });
    }

    const nutrition = calculateRecipeNutrition(ingredients, servings);

    const recipe = await updateRecipe(supabase, data.user.id, recipeId, {
      name,
      description: String(body.description || "").trim(),
      servings,
      ingredients,
      ...nutrition,
    });

    return Response.json({ recipe });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update recipe.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return Response.json({ error: "Sign in to delete recipes." }, { status: 401 });
    }

    const body = (await request.json()) as DeleteRequest;
    const recipeId = String(body.recipeId || "");
    if (!recipeId) {
      return Response.json({ error: "Recipe ID is required." }, { status: 400 });
    }

    await deleteRecipe(supabase, data.user.id, recipeId);
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete recipe.";
    return Response.json({ error: message }, { status: 500 });
  }
}
