import type { SupabaseClient } from "@supabase/supabase-js";

export type GroceryUnit = "g" | "item" | "meal";
export type GrocerySource = "planned" | "custom";
export type GroceryCategory = "Produce" | "Meat & seafood" | "Dairy & eggs" | "Pantry" | "Other";

export type PlannedIngredient = {
  name: string;
  amountGrams: number;
};

export type GroceryPlanMeal = {
  id: number;
  name: string;
  ingredients?: PlannedIngredient[];
};

export type GroceryItem = {
  itemKey: string;
  name: string;
  quantity: number;
  unit: GroceryUnit;
  category: GroceryCategory;
  sourceType: GrocerySource;
  checked: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const categories: GroceryCategory[] = [
  "Produce",
  "Meat & seafood",
  "Dairy & eggs",
  "Pantry",
  "Other",
];

const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function cleanName(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function keyPart(name: string) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 150) || "planned-food";
}

export function groceryCategory(name: string): GroceryCategory {
  const food = name.toLowerCase();

  if (/\b(chicken|turkey|beef|pork|lamb|steak|salmon|tuna|snapper|fish|prawn|shrimp|seafood|meat)\b/.test(food)) {
    return "Meat & seafood";
  }
  if (/\b(yoghurt|yogurt|milk|cheese|feta|cream|egg|eggs|butter)\b/.test(food)) {
    return "Dairy & eggs";
  }
  if (/\b(apple|apples|avocado|avocados|banana|bananas|berry|berries|blueberry|blueberries|raspberry|raspberries|strawberry|strawberries|spinach|broccoli|cabbage|capsicum|pepper|peppers|tomato|tomatoes|lettuce|carrot|carrots|onion|onions|lemon|lemons|fruit|vegetable|vegetables|greens)\b/.test(food)) {
    return "Produce";
  }
  if (/\b(rice|oat|oats|lentil|lentils|bean|beans|quinoa|pasta|bread|flour|oil|sauce|spice|almond|peanut|nut|nuts|seed|seeds|granola|cereal)\b/.test(food)) {
    return "Pantry";
  }
  return "Other";
}

function fallbackMealItem(meal: GroceryPlanMeal) {
  const manualMatch = cleanName(meal.name).match(/^(.*?)\s*·\s*(\d+(?:\.\d+)?)\s*g$/i);
  if (manualMatch) {
    return {
      name: cleanName(manualMatch[1]),
      quantity: numberValue(manualMatch[2]),
      unit: "g" as const,
    };
  }
  return {
    name: cleanName(meal.name) || "Planned meal",
    quantity: 1,
    unit: "meal" as const,
  };
}

export function buildPlannedGroceryItems(meals: GroceryPlanMeal[]): GroceryItem[] {
  const combined = new Map<string, GroceryItem>();

  meals.forEach(meal => {
    const ingredients = Array.isArray(meal.ingredients)
      ? meal.ingredients
          .map(ingredient => ({
            name: cleanName(ingredient?.name),
            quantity: numberValue(ingredient?.amountGrams),
            unit: "g" as const,
          }))
          .filter(ingredient => ingredient.name && ingredient.quantity > 0)
      : [];
    const groceryParts = ingredients.length ? ingredients : [fallbackMealItem(meal)];

    groceryParts.forEach(part => {
      if (!part.name || part.quantity <= 0) return;
      const itemKey = `planned:${part.unit}:${keyPart(part.name)}`;
      const existing = combined.get(itemKey);
      if (existing) {
        existing.quantity = round1(existing.quantity + part.quantity);
        return;
      }
      combined.set(itemKey, {
        itemKey,
        name: part.name,
        quantity: round1(part.quantity),
        unit: part.unit,
        category: groceryCategory(part.name),
        sourceType: "planned",
        checked: false,
      });
    });
  });

  return sortGroceryItems(Array.from(combined.values()));
}

export function sortGroceryItems(items: GroceryItem[]) {
  return [...items].sort((a, b) => {
    const categoryDifference = categories.indexOf(a.category) - categories.indexOf(b.category);
    return categoryDifference || a.name.localeCompare(b.name);
  });
}

function normalizeRow(row: Record<string, unknown>): GroceryItem {
  const category = String(row.category || "Other") as GroceryCategory;
  const unit = String(row.unit || "item") as GroceryUnit;
  return {
    itemKey: String(row.item_key || ""),
    name: cleanName(row.name) || "Grocery item",
    quantity: round1(numberValue(row.quantity)),
    unit: ["g", "item", "meal"].includes(unit) ? unit : "item",
    category: categories.includes(category) ? category : "Other",
    sourceType: row.source_type === "planned" ? "planned" : "custom",
    checked: Boolean(row.is_checked),
    createdAt: String(row.created_at || "") || undefined,
    updatedAt: String(row.updated_at || "") || undefined,
  };
}

function rowFor(userId: string, item: GroceryItem) {
  return {
    user_id: userId,
    item_key: item.itemKey,
    name: item.name,
    quantity: round1(item.quantity),
    unit: item.unit,
    category: item.category,
    source_type: item.sourceType,
    is_checked: item.checked,
  };
}

export async function loadGroceryItems(
  supabase: SupabaseClient,
  userId: string,
): Promise<GroceryItem[]> {
  const { data, error } = await supabase
    .from("grocery_items")
    .select("item_key,name,quantity,unit,category,source_type,is_checked,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return sortGroceryItems((data || []).map(row => normalizeRow(row)));
}

export async function reconcilePlannedGroceryItems(
  supabase: SupabaseClient,
  userId: string,
  plannedMeals: GroceryPlanMeal[],
): Promise<GroceryItem[]> {
  const current = await loadGroceryItems(supabase, userId);
  const currentByKey = new Map(current.map(item => [item.itemKey, item]));
  const planned = buildPlannedGroceryItems(plannedMeals).map(item => ({
    ...item,
    checked: currentByKey.get(item.itemKey)?.checked || false,
  }));

  if (planned.length) {
    const { error } = await supabase
      .from("grocery_items")
      .upsert(planned.map(item => rowFor(userId, item)), { onConflict: "user_id,item_key" });
    if (error) throw error;
  }

  const plannedKeys = new Set(planned.map(item => item.itemKey));
  const staleKeys = current
    .filter(item => item.sourceType === "planned" && !plannedKeys.has(item.itemKey))
    .map(item => item.itemKey);
  if (staleKeys.length) {
    const { error } = await supabase
      .from("grocery_items")
      .delete()
      .eq("user_id", userId)
      .in("item_key", staleKeys);
    if (error) throw error;
  }

  return loadGroceryItems(supabase, userId);
}

export async function setGroceryItemChecked(
  supabase: SupabaseClient,
  userId: string,
  itemKey: string,
  checked: boolean,
) {
  const { error } = await supabase
    .from("grocery_items")
    .update({ is_checked: checked })
    .eq("user_id", userId)
    .eq("item_key", itemKey);
  if (error) throw error;
}

export async function createCustomGroceryItem(
  supabase: SupabaseClient,
  userId: string,
  item: GroceryItem,
): Promise<GroceryItem> {
  const { data, error } = await supabase
    .from("grocery_items")
    .insert(rowFor(userId, { ...item, sourceType: "custom" }))
    .select("item_key,name,quantity,unit,category,source_type,is_checked,created_at,updated_at")
    .single();

  if (error || !data) throw error || new Error("The grocery item could not be saved.");
  return normalizeRow(data);
}

export async function deleteCustomGroceryItem(
  supabase: SupabaseClient,
  userId: string,
  itemKey: string,
) {
  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("user_id", userId)
    .eq("item_key", itemKey)
    .eq("source_type", "custom");
  if (error) throw error;
}
