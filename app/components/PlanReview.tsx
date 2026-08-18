"use client";
import { useState } from "react";

export type PlanMeal = {
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  foodName: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type DailyTotal = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type GeneratedPlan = {
  meals: PlanMeal[];
  dailyTotals: DailyTotal[];
};

export type FoodPaletteItem = {
  food_name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  preferred_slots: string[];
};

type Props = {
  plan: GeneratedPlan;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  foodPalette?: FoodPaletteItem[];
  onAccept: (meals: PlanMeal[]) => void;
  onReject: () => void;
  onRegenerateMeal?: (date: string, slot: string) => void;
};

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

const slotOrder = ["breakfast", "lunch", "dinner", "snack"];

function dateLabel(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function calorieColor(actual: number, target: number) {
  const pct = (actual / target) * 100;
  if (pct >= 85 && pct <= 115) return "#a9f47a";
  if (pct >= 70 && pct <= 130) return "#f0a467";
  return "#ee9e78";
}

const round1 = (v: number) => Math.round((v + Number.EPSILON) * 10) / 10;

export default function PlanReview({
  plan,
  calorieGoal,
  proteinGoal,
  carbsGoal,
  fatGoal,
  foodPalette = [],
  onAccept,
  onReject,
}: Props) {
  const [meals, setMeals] = useState<PlanMeal[]>(plan.meals);
  const [rejectedMeals, setRejectedMeals] = useState<Set<string>>(new Set());
  const [swappingKey, setSwappingKey] = useState<string | null>(null);

  const mealKey = (m: PlanMeal, idx: number) => `${m.date}-${m.slot}-${idx}`;

  // Get available foods for a given slot from the palette
  const getFoodsForSlot = (slot: string): FoodPaletteItem[] => {
    return foodPalette.filter((f) => {
      const slots = f.preferred_slots;
      if (!slots || !Array.isArray(slots)) return false;
      return slots.includes(slot);
    });
  };

  // Swap a meal's food and recalculate nutrition
  const swapFood = (mealIdx: number, newFood: FoodPaletteItem) => {
    setMeals((prev) => {
      const updated = [...prev];
      const oldMeal = updated[mealIdx];
      if (!oldMeal) return prev;

      // Keep the same calorie budget, recalculate grams
      const targetCalories = oldMeal.calories;
      let grams: number;
      if (newFood.calories_per_100g > 0) {
        grams = Math.round((targetCalories / newFood.calories_per_100g) * 100);
      } else {
        grams = oldMeal.grams;
      }
      grams = Math.max(20, Math.min(500, grams));
      grams = Math.round(grams / 5) * 5;

      const calories = Math.round((newFood.calories_per_100g * grams) / 100);
      const protein = round1((newFood.protein_per_100g * grams) / 100);
      const carbs = round1((newFood.carbs_per_100g * grams) / 100);
      const fat = round1((newFood.fat_per_100g * grams) / 100);

      updated[mealIdx] = {
        ...oldMeal,
        foodName: newFood.food_name,
        grams,
        calories,
        protein,
        carbs,
        fat,
      };
      return updated;
    });
    setSwappingKey(null);
  };

  const toggleReject = (key: string) => {
    setRejectedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Group meals by date → slot
  const byDateSlot = new Map<string, Map<string, { meal: PlanMeal; idx: number }[]>>();
  meals.forEach((meal, idx) => {
    if (!byDateSlot.has(meal.date)) byDateSlot.set(meal.date, new Map());
    const slotMap = byDateSlot.get(meal.date)!;
    if (!slotMap.has(meal.slot)) slotMap.set(meal.slot, []);
    slotMap.get(meal.slot)!.push({ meal, idx });
  });

  const dates = Array.from(byDateSlot.keys()).sort();

  // Recalculate daily totals excluding rejected meals
  const acceptedMeals = meals.filter((_, idx) => {
    const key = mealKey(meals[idx], idx);
    return !rejectedMeals.has(key);
  });

  const acceptedTotals = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const meal of acceptedMeals) {
    const t = acceptedTotals.get(meal.date) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    t.calories += Math.round(meal.calories);
    t.protein = round1(t.protein + meal.protein);
    t.carbs = round1(t.carbs + meal.carbs);
    t.fat = round1(t.fat + meal.fat);
    acceptedTotals.set(meal.date, t);
  }

  return (
    <div className="plan-review-overlay" style={{ padding: "0 0 40px" }}>
      <div className="plan-review-header" style={{ textAlign: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "24px", letterSpacing: "-.04em", margin: "0 0 6px" }}>Your AI-Generated Plan</h2>
        <p style={{ color: "#8e9a91", fontSize: "12px", margin: 0 }}>
          Tap <strong style={{ color: "#a9f47a" }}>Swap</strong> to switch foods for any day. Tap <strong style={{ color: "#ee9e78" }}>Remove</strong> to skip an item.
        </p>
      </div>

      {dates.map((date) => {
        const slotMap = byDateSlot.get(date)!;
        const totals = acceptedTotals.get(date) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const calColor = calorieColor(totals.calories, calorieGoal);

        return (
          <div key={date} className="plan-review-day" style={{ marginBottom: "28px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <h3 style={{ fontSize: "16px", margin: 0 }}>{dateLabel(date)}</h3>
              <div style={{ display: "flex", gap: "12px", fontSize: "10px", color: "#8e9a91" }}>
                <span>
                  <strong style={{ color: calColor }}>{totals.calories}</strong> / {calorieGoal} kcal
                </span>
                <span>
                  P: <strong style={{ color: "#f4f7f4" }}>{totals.protein}g</strong>
                </span>
                <span>
                  C: <strong style={{ color: "#f4f7f4" }}>{totals.carbs}g</strong>
                </span>
                <span>
                  F: <strong style={{ color: "#f4f7f4" }}>{totals.fat}g</strong>
                </span>
              </div>
            </div>

            {slotOrder.map((slot) => {
              const slotEntries = slotMap.get(slot) || [];
              if (slotEntries.length === 0) return null;

              const slotCalories = slotEntries
                .filter(({ meal, idx }) => !rejectedMeals.has(mealKey(meal, idx)))
                .reduce((sum, { meal }) => sum + meal.calories, 0);
              const slotProtein = slotEntries
                .filter(({ meal, idx }) => !rejectedMeals.has(mealKey(meal, idx)))
                .reduce((sum, { meal }) => sum + meal.protein, 0);

              return (
                <div
                  key={slot}
                  style={{
                    marginBottom: "10px",
                    background: "#101512",
                    border: "1px solid #242c26",
                    borderRadius: "16px",
                    overflow: "hidden",
                  }}
                >
                  {/* Slot header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderBottom: "1px solid #1c2620",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px" }}>{slotIcons[slot]}</span>
                      <strong
                        style={{
                          fontSize: "12px",
                          textTransform: "uppercase",
                          letterSpacing: ".07em",
                          color: "#a9f47a",
                        }}
                      >
                        {slotLabels[slot]}
                      </strong>
                    </div>
                    <span style={{ fontSize: "10px", color: "#8e9a91" }}>
                      {slotCalories} kcal · {Math.round(slotProtein)}g protein · {slotEntries.length}{" "}
                      {slotEntries.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  {/* Food items in this slot */}
                  {slotEntries.map(({ meal, idx }) => {
                    const key = mealKey(meal, idx);
                    const rejected = rejectedMeals.has(key);
                    const isSwapping = swappingKey === key;
                    const swapOptions = getFoodsForSlot(slot).filter((f) => f.food_name !== meal.foodName);

                    return (
                      <div key={key}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 14px",
                            borderBottom: isSwapping ? "none" : "1px solid #1c2620",
                            opacity: rejected ? 0.45 : 1,
                            transition: "opacity .2s",
                          }}
                        >
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "8px",
                              display: "grid",
                              placeItems: "center",
                              background: rejected ? "#3a2a22" : "#193423",
                              color: rejected ? "#ee9e78" : "#a9f47a",
                              fontSize: "12px",
                              flex: "0 0 28px",
                            }}
                          >
                            {rejected ? "✕" : "✓"}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4
                              style={{
                                fontSize: "12px",
                                margin: "0 0 2px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                textDecoration: rejected ? "line-through" : "none",
                              }}
                            >
                              {meal.foodName}
                            </h4>
                            <p style={{ color: "#98a49b", fontSize: "9px", margin: 0 }}>
                              {meal.grams}g · <b>{meal.calories} kcal</b> · P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g
                            </p>
                          </div>
                          {!rejected && (
                            <>
                              <button
                                onClick={() => setSwappingKey(isSwapping ? null : key)}
                                style={{
                                  border: `1px solid ${isSwapping ? "#a9f47a" : "#465149"}`,
                                  borderRadius: "8px",
                                  background: isSwapping ? "rgba(169,244,122,0.15)" : "transparent",
                                  color: isSwapping ? "#a9f47a" : "#8e9a91",
                                  padding: "4px 8px",
                                  fontSize: "9px",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {isSwapping ? "Close" : "Swap"}
                              </button>
                              <button
                                onClick={() => toggleReject(key)}
                                style={{
                                  border: "1px solid #465149",
                                  borderRadius: "8px",
                                  background: "transparent",
                                  color: "#8e9a91",
                                  padding: "4px 8px",
                                  fontSize: "9px",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Remove
                              </button>
                            </>
                          )}
                          {rejected && (
                            <button
                              onClick={() => toggleReject(key)}
                              style={{
                                border: "1px solid #ee9e78",
                                borderRadius: "8px",
                                background: "rgba(238,158,120,0.15)",
                                color: "#ee9e78",
                                padding: "4px 8px",
                                fontSize: "9px",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Undo
                            </button>
                          )}
                        </div>

                        {/* Swap dropdown */}
                        {isSwapping && (
                          <div
                            style={{
                              padding: "8px 14px 12px",
                              borderBottom: "1px solid #1c2620",
                              background: "#0d100e",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "10px",
                                color: "#8e9a91",
                                margin: "0 0 8px",
                                textTransform: "uppercase",
                                letterSpacing: ".05em",
                              }}
                            >
                              Swap with another {slotLabels[slot].toLowerCase()} food
                            </p>
                            {swapOptions.length === 0 ? (
                              <p style={{ fontSize: "11px", color: "#8e9a91", margin: 0, fontStyle: "italic" }}>
                                No other foods assigned to {slotLabels[slot].toLowerCase()}. Add more in My Foods.
                              </p>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {swapOptions.map((food) => (
                                  <button
                                    key={food.food_name}
                                    onClick={() => swapFood(idx, food)}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      padding: "8px 12px",
                                      borderRadius: "10px",
                                      border: "1px solid #242c26",
                                      background: "#101512",
                                      color: "#f4f7f4",
                                      cursor: "pointer",
                                      textAlign: "left",
                                    }}
                                  >
                                    <div>
                                      <strong style={{ fontSize: "11px" }}>{food.food_name}</strong>
                                      <br />
                                      <span style={{ fontSize: "9px", color: "#8e9a91" }}>
                                        {Math.round(food.calories_per_100g)} kcal/100g · P {Math.round(food.protein_per_100g)}g · C {Math.round(food.carbs_per_100g)}g · F {Math.round(food.fat_per_100g)}g
                                      </span>
                                    </div>
                                    <span style={{ color: "#a9f47a", fontSize: "12px" }}>→</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginTop: "20px",
          position: "sticky",
          bottom: "0",
          padding: "16px 0",
          background: "linear-gradient(to top, var(--bg) 60%, transparent)",
        }}
      >
        <button
          onClick={onReject}
          style={{
            flex: 1,
            border: "1px solid #2c352f",
            borderRadius: "16px",
            background: "var(--panel-2)",
            color: "#8e9a91",
            padding: "14px",
            fontWeight: 700,
            fontSize: "13px",
          }}
        >
          Start Over
        </button>
        <button
          onClick={() => onAccept(acceptedMeals)}
          style={{
            flex: 1.5,
            border: "none",
            borderRadius: "16px",
            background: "var(--green)",
            color: "#101810",
            padding: "14px",
            fontWeight: 800,
            fontSize: "13px",
            boxShadow: "0 6px 20px #a9f47a30",
          }}
        >
          Accept Plan ({acceptedMeals.length} meals)
        </button>
      </div>
    </div>
  );
}
