"use client";
import { useEffect, useState, useCallback } from "react";
import {
  type Recipe,
  type RecipeIngredient,
} from "../../lib/recipes";
import {
  type Micronutrients,
  MICRONUTRIENT_KEYS,
  MICRONUTRIENT_LABELS,
  MICRONUTRIENT_UNITS,
  MICRONUTRIENT_DV,
  EMPTY_MICRONUTRIENTS,
  hasMicronutrientData,
} from "../../lib/micronutrients";
import { calculateManualNutrition, type ManualFoodItem } from "../../lib/manual-food";

type FoodSearchResult = {
  sourceKey: string;
  sourceType: string;
  name: string;
  brandName?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fibrePer100g: number;
  micros?: Micronutrients;
  nutritionSource: string;
};

function round1(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function RecipeCreator({ onLogRecipe }: { onLogRecipe: (recipe: Recipe) => void }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [toast, setToast] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState(1);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  useEffect(() => {
    loadRecipes();
  }, []);

  async function loadRecipes() {
    setLoading(true);
    try {
      const res = await fetch("/api/recipes", { method: "GET" });
      const data = await res.json();
      if (data.recipes) setRecipes(data.recipes);
    } catch {
      notify("Could not load recipes.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch("/api/food-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setSearchResults(data.foods || []);
    } catch {
      notify("Food search failed.");
    } finally {
      setSearching(false);
    }
  }

  function addIngredient(result: FoodSearchResult, grams: number) {
    const safeGrams = Math.min(5000, Math.max(1, Math.round(grams)));
    const ratio = safeGrams / 100;
    const micros = result.micros
      ? {
          vitaminA: round1(result.micros.vitaminA * ratio),
          vitaminC: round1(result.micros.vitaminC * ratio),
          vitaminD: round1(result.micros.vitaminD * ratio),
          vitaminE: round1(result.micros.vitaminE * ratio),
          vitaminK: round1(result.micros.vitaminK * ratio),
          thiamin: round1(result.micros.thiamin * ratio),
          riboflavin: round1(result.micros.riboflavin * ratio),
          niacin: round1(result.micros.niacin * ratio),
          vitaminB6: round1(result.micros.vitaminB6 * ratio),
          folate: round1(result.micros.folate * ratio),
          vitaminB12: round1(result.micros.vitaminB12 * ratio),
          calcium: round1(result.micros.calcium * ratio),
          iron: round1(result.micros.iron * ratio),
          magnesium: round1(result.micros.magnesium * ratio),
          potassium: round1(result.micros.potassium * ratio),
          zinc: round1(result.micros.zinc * ratio),
          sodium: round1(result.micros.sodium * ratio),
        }
      : undefined;

    const newIngredient: RecipeIngredient = {
      name: result.name,
      grams: safeGrams,
      calories: Math.round(result.caloriesPer100g * ratio),
      protein: round1(result.proteinPer100g * ratio),
      carbs: round1(result.carbsPer100g * ratio),
      fat: round1(result.fatPer100g * ratio),
      fibre: round1(result.fibrePer100g * ratio),
      micros,
    };

    setIngredients([...ingredients, newIngredient]);
    setSearchResults([]);
    setSearchQuery("");
  }

  function addCustomIngredient() {
    const name = searchQuery.trim();
    if (name.length < 2) return;
    setIngredients([
      ...ingredients,
      {
        name,
        grams: 100,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fibre: 0,
      },
    ]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function updateIngredientGrams(index: number, grams: number) {
    const safeGrams = Math.min(5000, Math.max(1, Math.round(grams)));
    const updated = [...ingredients];
    const ing = updated[index];
    const ratio = safeGrams / (ing.grams || 100);
    updated[index] = {
      ...ing,
      grams: safeGrams,
      calories: Math.round(ing.calories * ratio),
      protein: round1(ing.protein * ratio),
      carbs: round1(ing.carbs * ratio),
      fat: round1(ing.fat * ratio),
      fibre: round1(ing.fibre * ratio),
      micros: ing.micros
        ? {
            vitaminA: round1(ing.micros.vitaminA * ratio),
            vitaminC: round1(ing.micros.vitaminC * ratio),
            vitaminD: round1(ing.micros.vitaminD * ratio),
            vitaminE: round1(ing.micros.vitaminE * ratio),
            vitaminK: round1(ing.micros.vitaminK * ratio),
            thiamin: round1(ing.micros.thiamin * ratio),
            riboflavin: round1(ing.micros.riboflavin * ratio),
            niacin: round1(ing.micros.niacin * ratio),
            vitaminB6: round1(ing.micros.vitaminB6 * ratio),
            folate: round1(ing.micros.folate * ratio),
            vitaminB12: round1(ing.micros.vitaminB12 * ratio),
            calcium: round1(ing.micros.calcium * ratio),
            iron: round1(ing.micros.iron * ratio),
            magnesium: round1(ing.micros.magnesium * ratio),
            potassium: round1(ing.micros.potassium * ratio),
            zinc: round1(ing.micros.zinc * ratio),
            sodium: round1(ing.micros.sodium * ratio),
          }
        : undefined,
    };
    setIngredients(updated);
  }

  // Calculate totals
  const totals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein: acc.protein + ing.protein,
      carbs: acc.carbs + ing.carbs,
      fat: acc.fat + ing.fat,
      fibre: acc.fibre + ing.fibre,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
  );
  const perServing = {
    calories: Math.round(totals.calories / Math.max(1, servings)),
    protein: round1(totals.protein / Math.max(1, servings)),
    carbs: round1(totals.carbs / Math.max(1, servings)),
    fat: round1(totals.fat / Math.max(1, servings)),
    fibre: round1(totals.fibre / Math.max(1, servings)),
  };

  async function saveRecipe() {
    if (!name.trim() || name.trim().length < 2) {
      notify("Recipe name is too short.");
      return;
    }
    if (!ingredients.length) {
      notify("Add at least one ingredient.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        servings,
        ingredients,
      };
      const res = await fetch("/api/recipes", {
        method: editRecipe ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editRecipe ? { ...payload, recipeId: editRecipe.id } : payload),
      });
      const data = await res.json();
      if (data.error) {
        notify(data.error);
      } else {
        notify(editRecipe ? "Recipe updated!" : "Recipe created! 🎉");
        resetForm();
        loadRecipes();
      }
    } catch {
      notify("Could not save recipe.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(recipeId: string) {
    if (!confirm("Delete this recipe?")) return;
    try {
      await fetch("/api/recipes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId }),
      });
      loadRecipes();
      notify("Recipe deleted.");
    } catch {
      notify("Could not delete recipe.");
    }
  }

  function startEdit(recipe: Recipe) {
    setEditRecipe(recipe);
    setName(recipe.name);
    setDescription(recipe.description);
    setServings(recipe.servings);
    setIngredients(recipe.ingredients);
    setEditing(true);
  }

  function resetForm() {
    setEditing(false);
    setEditRecipe(null);
    setName("");
    setDescription("");
    setServings(1);
    setIngredients([]);
    setSearchQuery("");
    setSearchResults([]);
  }

  if (loading) {
    return (
      <section className="section-block">
        <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
          Loading your recipes… 📖
        </div>
      </section>
    );
  }

  if (!editing) {
    return (
      <>
        <section className="weekly-win">
          <div className="spark">🍳</div>
          <div>
            <p className="eyebrow">CUSTOM RECIPES</p>
            <h2>{recipes.length ? `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}` : "Create your first recipe"}</h2>
            <p>Build custom recipes, auto-calculate nutrition, and log servings to your daily food diary.</p>
          </div>
        </section>

        <button
          className="primary"
          onClick={() => { resetForm(); setEditing(true); }}
          style={{ width: "100%", marginTop: "16px", fontSize: "13px", padding: "14px", borderRadius: "16px" }}
        >
          ＋ Create New Recipe
        </button>

        {recipes.length > 0 && (
          <section className="section-block">
            <div className="meal-list">
              {recipes.map((recipe) => (
                <div key={recipe.id} className="meal-card" style={{ flexDirection: "column", alignItems: "stretch", padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div className="meal-image" style={{ background: "linear-gradient(145deg,#4a6741,#86b97a)" }}>🍳</div>
                    <div className="meal-info" style={{ flex: 1 }}>
                      <span>RECIPE · {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}</span>
                      <h3>{recipe.name}</h3>
                      <p>
                        <b>·</b> {recipe.caloriesPerServing} kcal
                        <b>·</b> {recipe.proteinPerServing}g protein
                        <b>·</b> {recipe.carbsPerServing}g carbs
                        <b>·</b> {recipe.fatPerServing}g fat
                      </p>
                    </div>
                  </div>
                  {recipe.description && (
                    <p style={{ color: "var(--muted)", fontSize: "10px", margin: "8px 0 0" }}>{recipe.description}</p>
                  )}
                  <div className="plan-actions" style={{ marginTop: "10px" }}>
                    <button onClick={() => onLogRecipe(recipe)} style={{ color: "var(--green)" }}>＋ Log serving</button>
                    <button onClick={() => startEdit(recipe)}>Edit</button>
                    <button onClick={() => handleDelete(recipe.id)} style={{ color: "#e57373" }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {toast && (
          <div style={{ position: "fixed", bottom: "100px", left: "50%", transform: "translateX(-50%)", background: "var(--green-dark)", color: "var(--green)", padding: "10px 20px", borderRadius: "12px", fontSize: "12px", zIndex: 50 }}>
            {toast}
          </div>
        )}
      </>
    );
  }

  // Editing/Creating form
  return (
    <>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{editRecipe ? "EDIT RECIPE" : "NEW RECIPE"}</p>
            <h2>{editRecipe ? editRecipe.name : "Create a recipe"}</h2>
          </div>
          <button onClick={resetForm}>← Back</button>
        </div>

        {/* Name */}
        <input
          type="text"
          placeholder="Recipe name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />

        {/* Description */}
        <textarea
          placeholder="Short description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={{ ...inputStyle, marginTop: "10px", resize: "vertical" }}
        />

        {/* Servings */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "14px" }}>
          <label style={{ color: "var(--muted)", fontSize: "11px", fontWeight: 700 }}>SERVINGS</label>
          <input
            type="number"
            min={1}
            max={50}
            value={servings}
            onChange={(e) => setServings(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            style={{ ...inputStyle, width: "80px", textAlign: "center" }}
          />
        </div>

        {/* Ingredient search */}
        <div style={{ marginTop: "20px" }}>
          <p className="eyebrow" style={{ marginBottom: "8px" }}>ADD INGREDIENTS</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder="Search foods (e.g. chicken breast)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={handleSearch}
              disabled={searching || searchQuery.trim().length < 2}
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "1px solid var(--green)",
                background: "transparent",
                color: "var(--green)",
                fontSize: "11px",
                fontWeight: 700,
                opacity: searching || searchQuery.trim().length < 2 ? 0.5 : 1,
              }}
            >
              {searching ? "…" : "Search"}
            </button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div style={{ marginTop: "8px", maxHeight: "200px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "12px" }}>
              {searchResults.map((result) => (
                <div
                  key={result.sourceKey}
                  onClick={() => addIngredient(result, 100)}
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--line)",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  <strong>{result.name}</strong>
                  {result.brandName && <span style={{ color: "var(--muted)", marginLeft: "6px" }}>· {result.brandName}</span>}
                  <span style={{ color: "var(--muted)", marginLeft: "8px" }}>
                    {result.caloriesPer100g} kcal / 100g
                  </span>
                </div>
              ))}
            </div>
          )}

          {searchQuery.trim().length >= 2 && searchResults.length === 0 && !searching && (
            <button
              onClick={addCustomIngredient}
              style={{ marginTop: "8px", fontSize: "11px", color: "var(--muted)", background: "none", border: "0", textDecoration: "underline" }}
            >
              ＋ Add "{searchQuery.trim()}" as custom ingredient (nutrition not auto-calculated)
            </button>
          )}
        </div>

        {/* Ingredient list */}
        {ingredients.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <p className="eyebrow" style={{ marginBottom: "8px" }}>INGREDIENTS ({ingredients.length})</p>
            <div className="meal-list">
              {ingredients.map((ing, index) => (
                <div key={index} className="meal-card" style={{ padding: "10px 12px" }}>
                  <div className="meal-info" style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "12px" }}>{ing.name}</h3>
                    <p>
                      <b>·</b> {ing.calories} kcal
                      <b>·</b> {ing.protein}g protein
                      <b>·</b> {ing.carbs}g carbs
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={ing.grams}
                      onChange={(e) => updateIngredientGrams(index, Number(e.target.value))}
                      style={{ width: "60px", padding: "6px", textAlign: "center", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)", fontSize: "11px" }}
                    />
                    <span style={{ color: "var(--muted)", fontSize: "10px" }}>g</span>
                    <button
                      onClick={() => removeIngredient(index)}
                      style={{ background: "none", border: "0", color: "#e57373", fontSize: "16px", padding: "4px 8px" }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nutrition per serving */}
        {ingredients.length > 0 && (
          <div style={{ marginTop: "16px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "16px", padding: "16px" }}>
            <p className="eyebrow" style={{ marginBottom: "10px" }}>NUTRITION PER SERVING</p>
            <div className="macro-row" style={{ paddingTop: 0, borderTop: "0" }}>
              <div className="macro">
                <span>Calories</span>
                <strong>{perServing.calories}</strong>
              </div>
              <div className="macro">
                <span>Protein</span>
                <strong>{perServing.protein}g</strong>
              </div>
              <div className="macro">
                <span>Carbs</span>
                <strong>{perServing.carbs}g</strong>
              </div>
              <div className="macro">
                <span>Fat</span>
                <strong>{perServing.fat}g</strong>
              </div>
              <div className="macro">
                <span>Fibre</span>
                <strong>{perServing.fibre}g</strong>
              </div>
            </div>
            <p style={{ fontSize: "9px", color: "var(--muted)", marginTop: "8px" }}>
              Total for {servings} {servings === 1 ? "serving" : "servings"}: {totals.calories} kcal
            </p>
          </div>
        )}

        {/* Save button */}
        <button
          className="primary wide-button"
          onClick={saveRecipe}
          disabled={saving || !name.trim() || !ingredients.length}
          style={{ opacity: saving || !name.trim() || !ingredients.length ? 0.5 : 1 }}
        >
          {saving ? "Saving…" : editRecipe ? "Update Recipe" : "Save Recipe"}
        </button>
      </section>

      {toast && (
        <div style={{ position: "fixed", bottom: "100px", left: "50%", transform: "translateX(-50%)", background: "var(--green-dark)", color: "var(--green)", padding: "10px 20px", borderRadius: "12px", fontSize: "12px", zIndex: 50 }}>
          {toast}
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--text)",
  fontSize: "13px",
  outline: "none",
  width: "100%",
};
