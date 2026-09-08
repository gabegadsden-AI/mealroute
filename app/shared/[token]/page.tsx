import { createClient } from "../../../lib/supabase/client";
import { loadSharedPlanByToken, type SharedPlanMeal } from "../../../lib/shared-plans";
import { mealSlotLabels } from "../../../lib/weekly-plan";

function formatDate(key: string): string {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function groupByDay(meals: SharedPlanMeal[]) {
  const groups = new Map<string, SharedPlanMeal[]>();
  for (const meal of meals) {
    const date = meal.plannedDate || "Unscheduled";
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(meal);
  }
  return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

const SLOT_ORDER = ["breakfast", "lunch", "dinner", "snack"];

export default async function SharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const plan = await loadSharedPlanByToken(token);

  if (!plan) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#ffffff", color: "#1c2920", fontFamily: "Inter, sans-serif" }}>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
          <h1 style={{ fontSize: "24px", marginBottom: "8px" }}>Plan not found</h1>
          <p style={{ color: "#6f7d74", fontSize: "14px" }}>
            This shared meal plan link may have expired or been deleted.
          </p>
          <p style={{ marginTop: "24px" }}>
            <a href="/" style={{ color: "var(--green-text)", textDecoration: "none", fontSize: "13px" }}>
              → Go to MealRoute
            </a>
          </p>
        </div>
      </div>
    );
  }

  const grouped = groupByDay(plan.meals);
  const totalCalories = plan.meals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const totalProtein = plan.meals.reduce((sum, m) => sum + (m.protein || 0), 0);
  const totalCarbs = plan.meals.reduce((sum, m) => sum + (m.carbs || 0), 0);
  const totalFat = plan.meals.reduce((sum, m) => sum + (m.fat || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#1c2920", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "20px" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(145deg,#ffffff,#f4f8f5 68%)", border: "1px solid #dfe6e0", borderRadius: "20px", padding: "24px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <div style={{ background: "#5db04d", color: "#1c2920", width: "38px", height: "38px", borderRadius: "12px", display: "grid", placeItems: "center", fontWeight: 950, fontSize: "21px", transform: "rotate(-4deg)" }}>M</div>
            <span style={{ color: "#6f7d74", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em" }}>SHARED MEAL PLAN</span>
          </div>
          <h1 style={{ fontSize: "24px", margin: "8px 0 4px", letterSpacing: "-0.03em" }}>{plan.planTitle}</h1>
          {plan.weekStart && (
            <p style={{ color: "#6f7d74", fontSize: "13px", margin: 0 }}>
              Week of {formatDate(plan.weekStart)}
            </p>
          )}
        </div>

        {/* Totals */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "24px" }}>
          <div style={{ background: "#ffffff", border: "1px solid #dfe6e0", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--green-text)" }}>{totalCalories.toLocaleString()}</div>
            <div style={{ fontSize: "10px", color: "#6f7d74" }}>Total kcal</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #dfe6e0", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--green-text)" }}>{Math.round(totalProtein)}g</div>
            <div style={{ fontSize: "10px", color: "#6f7d74" }}>Protein</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #dfe6e0", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--green-text)" }}>{Math.round(totalCarbs)}g</div>
            <div style={{ fontSize: "10px", color: "#6f7d74" }}>Carbs</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #dfe6e0", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--green-text)" }}>{Math.round(totalFat)}g</div>
            <div style={{ fontSize: "10px", color: "#6f7d74" }}>Fat</div>
          </div>
        </div>

        {/* Meals grouped by day */}
        {grouped.map(([date, meals]) => (
          <div key={date} style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "16px", marginBottom: "12px", color: "var(--green-text)" }}>
              {date === "Unscheduled" ? "Unscheduled" : formatDate(date)}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {meals
                .sort((a, b) => SLOT_ORDER.indexOf(a.mealSlot || "") - SLOT_ORDER.indexOf(b.mealSlot || ""))
                .map((meal, i) => (
                <div key={i} style={{ background: "#ffffff", border: "1px solid #dfe6e0", borderRadius: "16px", padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "48px", height: "48px", borderRadius: "12px", display: "grid", placeItems: "center",
                      fontSize: "22px", flexShrink: 0,
                      background: `linear-gradient(145deg,#${meal.color || "salmon"}33,#${meal.color || "salmon"}11)`,
                    }}>
                      🍽️
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {meal.mealSlot && (
                        <span style={{ color: "var(--green-text)", background: "#e8f4e4", fontSize: "8px", padding: "3px 6px", borderRadius: "20px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                          {mealSlotLabels[meal.mealSlot as keyof typeof mealSlotLabels] || meal.mealSlot}
                        </span>
                      )}
                      <h3 style={{ fontSize: "13px", margin: "6px 0 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meal.name}</h3>
                      <p style={{ color: "#6f7d74", fontSize: "10px", margin: 0 }}>
                        <b style={{ color: "#9aa49d" }}>·</b> {meal.calories} kcal
                        <b style={{ color: "#9aa49d" }}>·</b> {meal.protein}g protein
                        <b style={{ color: "#9aa49d" }}>·</b> {meal.carbs}g carbs
                        <b style={{ color: "#9aa49d" }}>·</b> {meal.fat}g fat
                      </p>
                    </div>
                  </div>
                  {meal.ingredients && meal.ingredients.length > 0 && (
                    <div style={{ marginTop: "10px", paddingLeft: "60px" }}>
                      <p style={{ color: "#6f7d74", fontSize: "10px", margin: 0 }}>
                        {meal.ingredients.map(ing => `${ing.name} (${ing.amountGrams}g)`).join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ marginTop: "32px", textAlign: "center", paddingBottom: "40px" }}>
          <p style={{ color: "#6f7d74", fontSize: "12px" }}>
            Shared via <strong style={{ color: "var(--green-text)" }}>MealRoute</strong> 🥗
          </p>
          <p style={{ marginTop: "8px" }}>
            <a href="/" style={{ color: "var(--green-text)", textDecoration: "none", fontSize: "13px", fontWeight: 700 }}>
              Create your own meal plan →
            </a>
          </p>
          <button
            onClick={() => window.print()}
            style={{
              marginTop: "16px", padding: "10px 20px", borderRadius: "12px",
              border: "1px solid #dfe6e0", background: "#f4f8f5", color: "var(--green-text)",
              fontSize: "12px", fontWeight: 700, cursor: "pointer",
            }}
          >
            📄 Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
