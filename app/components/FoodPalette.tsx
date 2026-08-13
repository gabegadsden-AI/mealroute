"use client";

import { useState } from "react";

export type PaletteFood = {
  id: string;
  foodName: string;
  fdcId?: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fibrePer100g: number;
  category: string;
  preferredSlots: string[];
};

type USDSASearchResult = {
  fdcId: number;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fibrePer100g: number;
};

type Props = {
  palette: PaletteFood[];
  onAdd: (food: Omit<PaletteFood, "id">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdateSlots: (id: string, slots: string[]) => Promise<void>;
};

const allSlots = ["breakfast", "lunch", "dinner", "snack"];
const slotLabels: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const slotIcons: Record<string, string> = {
  breakfast: "☀",
  lunch: "☀",
  dinner: "☾",
  snack: "✦",
};

function groceryCategory(name: string): string {
  const food = name.toLowerCase();
  if (/\b(chicken|turkey|beef|pork|lamb|steak|salmon|tuna|fish|prawn|shrimp|seafood|meat)\b/.test(food)) return "Meat & seafood";
  if (/\b(yoghurt|yogurt|milk|cheese|feta|cream|egg|eggs|butter)\b/.test(food)) return "Dairy & eggs";
  if (/\b(apple|avocado|banana|berry|berries|spinach|broccoli|cabbage|capsicum|tomato|lettuce|carrot|onion|lemon|fruit|vegetable|greens)\b/.test(food)) return "Produce";
  if (/\b(rice|oat|oats|lentil|beans|quinoa|pasta|bread|flour|oil|sauce|spice|almond|peanut|nut|nuts|seed|granola|cereal)\b/.test(food)) return "Pantry";
  return "Other";
}

export default function FoodPalette({ palette, onAdd, onDelete, onUpdateSlots }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<USDSASearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedFoodId, setExpandedFoodId] = useState<string | null>(null);
  const [savingSlots, setSavingSlots] = useState(false);

  const searchFoods = async () => {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch("/api/food-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setSearchResults([]);
      } else {
        setSearchResults(data.foods || []);
      }
    } catch {
      setError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const addFood = async (result: USDSASearchResult) => {
    setAdding(true);
    setError("");
    try {
      await onAdd({
        foodName: result.name,
        fdcId: result.fdcId,
        caloriesPer100g: result.caloriesPer100g,
        proteinPer100g: result.proteinPer100g,
        carbsPer100g: result.carbsPer100g,
        fatPer100g: result.fatPer100g,
        fibrePer100g: result.fibrePer100g,
        category: groceryCategory(result.name),
        preferredSlots: allSlots, // default to all slots, user assigns after
      });
      setSearchResults(prev => prev.filter(r => r.fdcId !== result.fdcId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add food.");
    } finally {
      setAdding(false);
    }
  };

  const toggleSlot = async (foodId: string, slot: string) => {
    const food = palette.find(f => f.id === foodId);
    if (!food) return;
    const current = food.preferredSlots;
    const updated = current.includes(slot)
      ? current.filter(s => s !== slot)
      : [...current, slot];
    // Optimistic update is handled by parent via onUpdateSlots
    setSavingSlots(true);
    try {
      await onUpdateSlots(foodId, updated);
    } catch {
      setError("Could not update meal assignment.");
    } finally {
      setSavingSlots(false);
    }
  };

  const hasEnoughFoods = palette.length >= 3;

  return (
    <div style={{ padding: "0 0 20px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", letterSpacing: "-.03em", margin: "0 0 4px" }}>My Foods</h2>
        <p style={{ color: "#8e9a91", fontSize: "11px", margin: 0 }}>
          Add foods you enjoy, then assign them to meals. We&apos;ll use these to build your meal plans.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchFoods()}
            placeholder="Search foods (e.g. chicken breast, oats, banana)..."
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: "14px",
              border: "1px solid #2c352f",
              background: "#111714",
              color: "#f4f7f4",
              fontSize: "13px",
              outline: "none",
            }}
          />
          <button
            onClick={searchFoods}
            disabled={searching}
            style={{
              border: "none",
              borderRadius: "14px",
              background: "var(--green)",
              color: "#101810",
              padding: "12px 18px",
              fontWeight: 700,
              fontSize: "12px",
              whiteSpace: "nowrap",
              opacity: searching ? 0.6 : 1,
            }}
          >
            {searching ? "..." : "Search"}
          </button>
        </div>
      </div>

      {error && (
        <p style={{ color: "#ee9e78", fontSize: "11px", margin: "0 0 12px" }}>{error}</p>
      )}

      {/* Search results */}
      {searchResults.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <p style={{ color: "#8e9a91", fontSize: "9px", textTransform: "uppercase", letterSpacing: ".07em", margin: "0 0 10px" }}>
            Search Results — Tap + to add
          </p>
          {searchResults.map(result => (
            <div
              key={result.fdcId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px",
                marginBottom: "6px",
                background: "#101512",
                border: "1px solid #242c26",
                borderRadius: "14px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: "12px", margin: "0 0 3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {result.name}
                </h4>
                <p style={{ color: "#98a49b", fontSize: "9px", margin: 0 }}>
                  {result.caloriesPer100g} kcal / 100g · P {result.proteinPer100g}g · C {result.carbsPer100g}g · F {result.fatPer100g}g
                </p>
              </div>
              <button
                onClick={() => addFood(result)}
                disabled={adding}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "10px",
                  border: "none",
                  background: "var(--green)",
                  color: "#101810",
                  fontSize: "18px",
                  fontWeight: 800,
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 32px",
                  opacity: adding ? 0.5 : 1,
                }}
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Current palette */}
      <div>
        <p style={{ color: "#8e9a91", fontSize: "9px", textTransform: "uppercase", letterSpacing: ".07em", margin: "0 0 10px" }}>
          Your Food Palette ({palette.length})
        </p>

        {palette.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "30px",
            color: "#8e9a91",
            fontSize: "12px",
            border: "1px dashed #2c352f",
            borderRadius: "16px",
          }}>
            No foods yet. Search above to add foods you enjoy.
          </div>
        )}

        {palette.map(food => {
          const isExpanded = expandedFoodId === food.id;
          return (
            <div
              key={food.id}
              style={{
                marginBottom: "8px",
                background: "var(--panel)",
                border: `1px solid ${isExpanded ? "var(--green)" : "#242d27"}`,
                borderRadius: "16px",
                overflow: "hidden",
                transition: "border-color .2s",
              }}
            >
              {/* Food row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px",
                  cursor: "pointer",
                }}
                onClick={() => setExpandedFoodId(isExpanded ? null : food.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontSize: "12px", margin: "0 0 3px" }}>{food.foodName}</h4>
                  <p style={{ color: "#98a49b", fontSize: "9px", margin: 0 }}>
                    {food.caloriesPer100g} kcal / 100g
                    {" · "}
                    {food.preferredSlots.length === allSlots.length
                      ? "All meals"
                      : food.preferredSlots.map(s => slotLabels[s]).join(", ")}
                  </p>
                </div>
                {/* Slot badges */}
                <div style={{ display: "flex", gap: "4px", flex: "0 0 auto" }}>
                  {allSlots.map(slot => {
                    const active = food.preferredSlots.includes(slot);
                    return (
                      <span
                        key={slot}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "8px",
                          display: "grid",
                          placeItems: "center",
                          fontSize: "10px",
                          fontWeight: 700,
                          background: active ? "rgba(169,244,122,0.15)" : "transparent",
                          color: active ? "var(--green)" : "#465149",
                          border: `1px solid ${active ? "var(--green)" : "#2c352f"}`,
                        }}
                      >
                        {slot.charAt(0).toUpperCase()}
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(food.id); }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "10px",
                    border: "1px solid #465149",
                    background: "transparent",
                    color: "#8e9a91",
                    fontSize: "14px",
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 28px",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Expanded slot assignment */}
              {isExpanded && (
                <div style={{
                  padding: "0 12px 14px",
                  borderTop: "1px solid #242d27",
                  paddingTop: "14px",
                }}>
                  <p style={{
                    color: "#8e9a91",
                    fontSize: "9px",
                    textTransform: "uppercase",
                    letterSpacing: ".07em",
                    margin: "0 0 10px",
                  }}>
                    Assign to meals {savingSlots && "· Saving..."}
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {allSlots.map(slot => {
                      const active = food.preferredSlots.includes(slot);
                      return (
                        <button
                          key={slot}
                          onClick={() => toggleSlot(food.id, slot)}
                          style={{
                            flex: 1,
                            border: `1px solid ${active ? "var(--green)" : "#2c352f"}`,
                            borderRadius: "12px",
                            background: active ? "rgba(169,244,122,0.12)" : "transparent",
                            color: active ? "var(--green)" : "#8e9a91",
                            padding: "10px 6px",
                            fontSize: "10px",
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all .2s",
                          }}
                        >
                          {slotLabels[slot]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Ready indicator */}
        {palette.length > 0 && (
          <div style={{
            marginTop: "16px",
            padding: "14px",
            borderRadius: "16px",
            background: hasEnoughFoods
              ? "linear-gradient(130deg,#1a241d,#101612)"
              : "#101512",
            border: `1px solid ${hasEnoughFoods ? "#2d392f" : "#242c26"}`,
            textAlign: "center",
          }}>
            <p style={{
              margin: 0,
              fontSize: "12px",
              color: hasEnoughFoods ? "var(--green)" : "#8e9a91",
              fontWeight: 600,
            }}>
              {hasEnoughFoods
                ? "✓ Ready! Go to Weekly Plan to generate your AI meal plan."
                : `Add ${3 - palette.length} more food${3 - palette.length === 1 ? "" : "s"} to unlock AI plan generation.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
