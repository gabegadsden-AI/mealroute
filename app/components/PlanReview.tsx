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

type Props = {
  plan: GeneratedPlan;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  onAccept: () => void;
  onReject: () => void;
  onRegenerateMeal: (date: string, slot: string) => void;
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

export default function PlanReview({
  plan,
  calorieGoal,
  proteinGoal,
  carbsGoal,
  fatGoal,
  onAccept,
  onReject,
  onRegenerateMeal,
}: Props) {
  const [rejectedMeals, setRejectedMeals] = useState<Set<string>>(new Set());

  const toggleReject = (key: string) => {
    setRejectedMeals(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Group meals by date → slot → foods
  const byDate = new Map<string, PlanMeal[]>();
  for (const meal of plan.meals) {
    const arr = byDate.get(meal.date) || [];
    arr.push(meal);
    byDate.set(meal.date, arr);
  }

  // Further group by slot within each date
  const byDateSlot = new Map<string, Map<string, PlanMeal[]>>();
  for (const [date, meals] of byDate) {
    const slotMap = new Map<string, PlanMeal[]>();
    for (const meal of meals) {
      const arr = slotMap.get(meal.slot) || [];
      arr.push(meal);
      slotMap.set(meal.slot, arr);
    }
    byDateSlot.set(date, slotMap);
  }

  const dates = Array.from(byDate.keys()).sort();
  const mealKey = (m: PlanMeal) => `${m.date}-${m.slot}-${m.foodName}`;
  const acceptedMeals = plan.meals.filter(m => !rejectedMeals.has(mealKey(m)));

  // Recalculate daily totals excluding rejected meals
  const acceptedTotals = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const meal of acceptedMeals) {
    const t = acceptedTotals.get(meal.date) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    t.calories += Math.round(meal.calories);
    t.protein = Math.round((t.protein + meal.protein) * 10) / 10;
    t.carbs = Math.round((t.carbs + meal.carbs) * 10) / 10;
    t.fat = Math.round((t.fat + meal.fat) * 10) / 10;
    acceptedTotals.set(meal.date, t);
  }

  return (
    <div className="plan-review-overlay" style={{ padding: "0 0 40px" }}>
      <div className="plan-review-header" style={{ textAlign: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "24px", letterSpacing: "-.04em", margin: "0 0 6px" }}>Your AI-Generated Plan</h2>
        <p style={{ color: "#8e9a91", fontSize: "12px", margin: 0 }}>Review each meal. Tap to reject items you don&apos;t want, then accept the plan.</p>
      </div>

      {dates.map(date => {
        const slotMap = byDateSlot.get(date)!;
        const totals = acceptedTotals.get(date) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const calColor = calorieColor(totals.calories, calorieGoal);

        return (
          <div key={date} className="plan-review-day" style={{ marginBottom: "28px" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}>
              <h3 style={{ fontSize: "16px", margin: 0 }}>{dateLabel(date)}</h3>
              <div style={{ display: "flex", gap: "12px", fontSize: "10px", color: "#8e9a91" }}>
                <span>
                  <strong style={{ color: calColor }}>{totals.calories}</strong> / {calorieGoal} kcal
                </span>
                <span>P: <strong style={{ color: "#f4f7f4" }}>{totals.protein}g</strong></span>
                <span>C: <strong style={{ color: "#f4f7f4" }}>{totals.carbs}g</strong></span>
                <span>F: <strong style={{ color: "#f4f7f4" }}>{totals.fat}g</strong></span>
              </div>
            </div>

            {slotOrder.map(slot => {
              const slotMeals = slotMap.get(slot) || [];
              if (slotMeals.length === 0) return null;

              // Calculate slot subtotal
              const slotCalories = slotMeals.reduce((sum, m) => rejectedMeals.has(mealKey(m)) ? sum : sum + m.calories, 0);
              const slotProtein = slotMeals.reduce((sum, m) => rejectedMeals.has(mealKey(m)) ? sum : sum + m.protein, 0);

              return (
                <div key={slot} style={{
                  marginBottom: "10px",
                  background: "#101512",
                  border: "1px solid #242c26",
                  borderRadius: "16px",
                  overflow: "hidden",
                }}>
                  {/* Slot header */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderBottom: "1px solid #1c2620",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px" }}>{slotIcons[slot]}</span>
                      <strong style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: ".07em", color: "#a9f47a" }}>
                        {slotLabels[slot]}
                      </strong>
                    </div>
                    <span style={{ fontSize: "10px", color: "#8e9a91" }}>
                      {slotCalories} kcal · {Math.round(slotProtein)}g protein · {slotMeals.length} {slotMeals.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  {/* Food items in this slot */}
                  {slotMeals.map(meal => {
                    const key = mealKey(meal);
                    const rejected = rejectedMeals.has(key);
                    return (
                      <div
                        key={key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 14px",
                          borderBottom: "1px solid #1c2620",
                          opacity: rejected ? 0.45 : 1,
                          transition: "opacity .2s",
                        }}
                      >
                        <div style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "8px",
                          display: "grid",
                          placeItems: "center",
                          background: rejected ? "#3a2a22" : "#193423",
                          color: rejected ? "#ee9e78" : "#a9f47a",
                          fontSize: "12px",
                          flex: "0 0 28px",
                        }}>
                          {rejected ? "✕" : "✓"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: "12px", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: rejected ? "line-through" : "none" }}>
                            {meal.foodName}
                          </h4>
                          <p style={{ color: "#98a49b", fontSize: "9px", margin: 0 }}>
                            {meal.grams}g · <b>{meal.calories} kcal</b> · P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g
                          </p>
                        </div>
                        <button
                          onClick={() => toggleReject(key)}
                          style={{
                            border: `1px solid ${rejected ? "#ee9e78" : "#465149"}`,
                            borderRadius: "8px",
                            background: rejected ? "rgba(238,158,120,0.15)" : "transparent",
                            color: rejected ? "#ee9e78" : "#8e9a91",
                            padding: "4px 8px",
                            fontSize: "9px",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {rejected ? "Undo" : "Remove"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: "10px", marginTop: "20px", position: "sticky", bottom: "0", padding: "16px 0", background: "linear-gradient(to top, var(--bg) 60%, transparent)" }}>
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
          onClick={onAccept}
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
