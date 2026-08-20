"use client";
import { useEffect, useMemo, useState } from "react";
import { localDateKey, mealTotals, dateFromKey, type MealHistory, type WeightSaveResult } from "../../lib/app-utils";
import { type WeightLog, weightInUnit, weightToKg } from "../../lib/weight-progress";
import { type NutriPathProfile } from "../../lib/profile";
import { type ManualFoodItem, calculateManualNutrition, customFoodKey, packagedProductFood } from "../../lib/manual-food";
import { type SavedPackagedProduct } from "../../lib/app-utils";
import { type MealSlot, mealSlotLabels } from "../../lib/weekly-plan";
import { MAX_DAILY_WATER_ML, MIN_WATER_GOAL_ML, MAX_WATER_GOAL_ML } from "../../lib/water-tracking";

export function Progress({
  range,
  setRange,
  history,
  target,
  proteinTarget,
  weightLogs,
  weightUnit,
  onLogWeight,
}: {
  range: string;
  setRange: (s: string) => void;
  history: MealHistory;
  target: number;
  proteinTarget: number;
  weightLogs: WeightLog[];
  weightUnit: "kg" | "lb";
  onLogWeight: () => void;
}) {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  const rangeDays = range === "Week" ? 7 : range === "Month" ? 30 : 90;
  const periodDates = today ? Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (rangeDays - 1 - index));
    return localDateKey(date);
  }) : [];
  const periodTotals = periodDates.map(date => ({ date, ...mealTotals(history[date] || []) }));
  const trackedDays = periodTotals.filter(day => day.count > 0);
  const totalCalories = trackedDays.reduce((sum, day) => sum + day.calories, 0);
  const averageCalories = trackedDays.length ? Math.round(totalCalories / trackedDays.length) : 0;
  const proteinTargetDays = trackedDays.filter(day => day.protein >= proteinTarget).length;
  const loggedMeals = trackedDays.reduce((sum, day) => sum + day.count, 0);
  const chartDays = periodTotals.slice(-7).map(day => ({
    key: day.date,
    day: dateFromKey(day.date).toLocaleDateString([], { weekday: "short" }),
    value: day.calories,
  }));
  const firstPeriodDate = periodDates[0] || "";
  const lastPeriodDate = periodDates[periodDates.length - 1] || "";
  const periodWeightLogs = weightLogs
    .filter(log => log.logged_on >= firstPeriodDate && log.logged_on <= lastPeriodDate)
    .sort((a, b) => a.logged_on.localeCompare(b.logged_on));
  const displayWeights = periodWeightLogs.map(log => weightInUnit(log.weight_kg, weightUnit));
  const firstWeight = displayWeights[0];
  const latestWeight = displayWeights[displayWeights.length - 1];
  const weightChange = displayWeights.length > 1 ? Math.round((latestWeight - firstWeight) * 10) / 10 : 0;
  const weightTrend = displayWeights.length < 2
    ? "Add another measurement to see a trend"
    : weightChange === 0
      ? `No change in this ${range.toLowerCase()} view`
      : `${Math.abs(weightChange).toFixed(1)} ${weightUnit} ${weightChange < 0 ? "down" : "up"}`;
  const chartMin = displayWeights.length ? Math.min(...displayWeights) : 0;
  const chartMax = displayWeights.length ? Math.max(...displayWeights) : 0;
  const chartSpread = Math.max(0.5, chartMax - chartMin);
  const weightPoints = displayWeights.map((value, index) => {
    const x = displayWeights.length === 1 ? 150 : 12 + (index / (displayWeights.length - 1)) * 276;
    const y = 100 - ((value - chartMin) / chartSpread) * 78;
    return { x, y, value, log: periodWeightLogs[index] };
  });
  return <>
    <div className="segment">{["Week", "Month", "3 months"].map(x => <button key={x} className={range === x ? "active" : ""} onClick={() => setRange(x)}>{x}</button>)}</div>
    <section className="weekly-win"><div className="spark">✦</div><div><p className="eyebrow">MEAL HISTORY</p><h2>{trackedDays.length ? `${trackedDays.length} ${trackedDays.length === 1 ? "day" : "days"} tracked.` : "Your history starts here."}</h2><p>{trackedDays.length ? `${loggedMeals} meals are saved in this ${range.toLowerCase()} view.` : "Log your first meal and NutriPath will build your calorie and macro history."}</p></div></section>
    <section className="stats-grid"><div><span>Days logged</span><strong>{trackedDays.length}</strong><small>of {rangeDays} days</small></div><div><span>Avg. calories</span><strong>{averageCalories.toLocaleString()}</strong><small>{averageCalories ? `${Math.abs(target - averageCalories).toLocaleString()} ${averageCalories <= target ? "below" : "above"} target` : "No entries yet"}</small></div><div><span>Protein target</span><strong>{proteinTargetDays}/{trackedDays.length || 0}</strong><small>tracked days reached</small></div><div><span>Meals logged</span><strong>{loggedMeals}</strong><small>confirmed as eaten</small></div></section>
    <section className="chart-card"><div className="section-heading"><div><p className="eyebrow">LAST 7 DAYS</p><h2>Calories by day</h2></div><span>{target.toLocaleString()} goal</span></div><div className="chart"><div className="goal-line"><span>Goal</span></div>{chartDays.map(day => <div className="bar-wrap" key={day.key}><div className={day.key === (today ? localDateKey(today) : "") ? "bar active" : "bar"} style={{ height: `${Math.max(8, Math.min(110, day.value / 20))}px` }}><span>{day.value || "–"}</span></div><small>{day.day}</small></div>)}</div></section>
    <section className="weight-progress-card">
      <div className="weight-progress-head">
        <div><p className="eyebrow">WEIGHT PROGRESS</p><h2>{periodWeightLogs.length ? `${latestWeight.toFixed(1)} ${weightUnit}` : "No weight logged"}</h2><span>{weightTrend}</span></div>
        <button type="button" onClick={onLogWeight}>＋ Log weight</button>
      </div>
      {weightPoints.length
        ? <>
          <div className="weight-chart" role="img" aria-label={`Weight trend with ${weightPoints.length} measurements`}>
            <svg viewBox="0 0 300 120" preserveAspectRatio="none">
              <line x1="12" y1="100" x2="288" y2="100" className="weight-chart-axis" />
              {weightPoints.length > 1 && <polyline points={weightPoints.map(point => `${point.x},${point.y}`).join(" ")} className="weight-chart-line" />}
              {weightPoints.map(point => <g key={point.log.id}><circle cx={point.x} cy={point.y} r="5" className="weight-chart-point" /><text x={point.x} y={Math.max(12, point.y - 10)} textAnchor="middle">{point.value.toFixed(1)}</text></g>)}
            </svg>
          </div>
          <div className="weight-chart-dates"><span>{dateFromKey(periodWeightLogs[0].logged_on).toLocaleDateString([], { day: "numeric", month: "short" })}</span><span>{dateFromKey(periodWeightLogs[periodWeightLogs.length - 1].logged_on).toLocaleDateString([], { day: "numeric", month: "short" })}</span></div>
        </>
        : <div className="weight-empty"><span>Log a measurement to start your private weight history.</span><small>NutriPath stores it under your signed-in account.</small></div>}
    </section>
  </>;
}

export function WeightProgressEditor({
  profile,
  logs,
  onBack,
  onReviewGoals,
  onSave,
  onDelete,
}: {
  profile: NutriPathProfile;
  logs: WeightLog[];
  onBack: () => void;
  onReviewGoals: () => void;
  onSave: (loggedOn: string, weightKg: number) => Promise<WeightSaveResult>;
  onDelete: (logId: string) => Promise<string>;
}) {
  const unit = profile.weight_unit || "kg";
  const today = localDateKey();
  const latestLog = [...logs].sort((a, b) => b.logged_on.localeCompare(a.logged_on))[0];
  const startingWeightKg = latestLog?.weight_kg || Number(profile.weight_kg || 0);
  const [loggedOn, setLoggedOn] = useState(today);
  const [weight, setWeight] = useState(startingWeightKg ? String(weightInUnit(startingWeightKg, unit)) : "");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [profileUpdated, setProfileUpdated] = useState(false);

  function selectDate(nextDate: string) {
    setLoggedOn(nextDate);
    const existing = logs.find(log => log.logged_on === nextDate);
    setWeight(existing ? String(weightInUnit(existing.weight_kg, unit)) : "");
    setSaved(false);
    setError("");
  }

  async function submitWeight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaved(false);

    const enteredWeight = Number(weight);
    const weightKg = weightToKg(enteredWeight, unit);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(loggedOn) || loggedOn > today) {
      setError("Choose today or an earlier date.");
      return;
    }
    if (!Number.isFinite(enteredWeight) || weightKg < 30 || weightKg > 350) {
      setError(`Enter a weight between ${unit === "lb" ? "66 and 772 lb" : "30 and 350 kg"}.`);
      return;
    }

    setSaving(true);
    const result = await onSave(loggedOn, weightKg);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setProfileUpdated(result.profileUpdated);
    setSaved(true);
  }

  async function deleteEntry(log: WeightLog) {
    if (deletingId || !window.confirm(`Remove the weight recorded on ${dateFromKey(log.logged_on).toLocaleDateString()}?`)) return;
    setDeletingId(log.id);
    setError("");
    const deleteError = await onDelete(log.id);
    setDeletingId("");
    if (deleteError) {
      setError(deleteError);
      return;
    }
    if (log.logged_on === loggedOn) setWeight("");
    setSaved(false);
  }

  const recentLogs = [...logs].sort((a, b) => b.logged_on.localeCompare(a.logged_on)).slice(0, 8);
  return <div className="weight-editor">
    <button className="goals-back" type="button" onClick={onBack}>‹ Profile</button>
    <p className="eyebrow">WEIGHT PROGRESS</p>
    <h2>Log your weight</h2>
    <p className="modal-sub">NutriPath uses your preferred {unit} display and securely stores the underlying measurement in kilograms.</p>

    <form className="weight-entry-form" onSubmit={submitWeight}>
      <label><span>Date</span><input type="date" value={loggedOn} max={today} onChange={event => selectDate(event.target.value)} /></label>
      <label><span>Weight</span><input type="number" inputMode="decimal" min={unit === "lb" ? "66" : "30"} max={unit === "lb" ? "772" : "350"} step="0.1" value={weight} onChange={event => { setWeight(event.target.value); setSaved(false); }} /><small>{unit}</small></label>
      <button className="primary full" type="submit" disabled={saving}>{saving ? "Saving weight…" : logs.some(log => log.logged_on === loggedOn) ? "Update weight" : "Save weight"}</button>
    </form>

    {error && <div className="auth-error">{error}</div>}
    {saved && <div className="weight-saved">
      <strong>Weight saved</strong>
      <span>{profileUpdated ? "Your profile now uses this as your current weight." : "This measurement was added to your history. Your latest profile weight remains unchanged."}</span>
      <b>Your calorie and macro targets were not changed.</b>
      <div><button type="button" onClick={onBack}>Keep current targets</button><button type="button" onClick={onReviewGoals}>Review goals</button></div>
    </div>}

    <section className="weight-history-list">
      <div className="goals-section-title"><strong>Recent measurements</strong><span>One measurement is saved per date</span></div>
      {recentLogs.length
        ? recentLogs.map(log => <div key={log.id}><span>{dateFromKey(log.logged_on).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span><strong>{weightInUnit(log.weight_kg, unit).toFixed(1)} {unit}</strong><button type="button" disabled={deletingId === log.id} onClick={() => deleteEntry(log)}>{deletingId === log.id ? "Removing…" : "Remove"}</button></div>)
        : <p>No measurements saved yet.</p>}
    </section>
    <p className="goals-safety">Weight changes can affect suggested targets. NutriPath always asks before you review or change calorie and macro targets.</p>
  </div>;
}

export function ManualFoodEditor({
  startMode,
  initialFood,
  recentFoods,
  savedProducts,
  onAdd,
}: {
  startMode: "search" | "saved" | "custom";
  initialFood: ManualFoodItem | null;
  recentFoods: ManualFoodItem[];
  savedProducts: SavedPackagedProduct[];
  onAdd: (food: ManualFoodItem, grams: number, destination: "today" | "plan") => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"search" | "saved" | "custom">(startMode);
  const [selectedFood, setSelectedFood] = useState<ManualFoodItem | null>(initialFood);
  const [grams, setGrams] = useState(initialFood ? String(initialFood.lastGrams || 100) : "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ManualFoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [customName, setCustomName] = useState("");
  const [customGrams, setCustomGrams] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [customFibre, setCustomFibre] = useState("");

  const savedFoods = useMemo(() => {
    const combined = [
      ...recentFoods,
      ...savedProducts.map(product => packagedProductFood(product)),
    ];
    const unique = new Map<string, ManualFoodItem>();
    combined.forEach(food => {
      if (!unique.has(food.sourceKey)) unique.set(food.sourceKey, food);
    });
    return Array.from(unique.values());
  }, [recentFoods, savedProducts]);

  const gramNumber = Number(grams);
  const validGrams = Number.isFinite(gramNumber) && gramNumber >= 1 && gramNumber <= 5000;
  const preview = selectedFood && validGrams
    ? calculateManualNutrition(selectedFood, gramNumber)
    : null;

  function chooseFood(food: ManualFoodItem) {
    setSelectedFood(food);
    setGrams(String(food.lastGrams || 100));
    setError("");
  }

  async function searchFoods(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.replace(/\s+/g, " ").trim();
    if (cleanQuery.length < 2) {
      setError("Enter at least two characters.");
      return;
    }
    setSearching(true);
    setError("");
    setResults([]);
    try {
      const response = await fetch("/api/food-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cleanQuery }),
      });
      const payload = await response.json() as { foods?: ManualFoodItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Food search failed.");
      setResults(Array.isArray(payload.foods) ? payload.foods : []);
      if (!payload.foods?.length) setError("No USDA foods matched that search. Try a simpler food name or use Custom.");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Food search failed.");
    } finally {
      setSearching(false);
    }
  }

  function reviewCustomFood(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const enteredGrams = Number(customGrams);
    const totals = {
      calories: Number(customCalories),
      protein: Number(customProtein || 0),
      carbs: Number(customCarbs || 0),
      fat: Number(customFat || 0),
      fibre: Number(customFibre || 0),
    };
    if (!customName.trim()) {
      setError("Enter a food name.");
      return;
    }
    if (!Number.isFinite(enteredGrams) || enteredGrams < 1 || enteredGrams > 5000) {
      setError("Enter a food weight between 1 and 5,000 grams.");
      return;
    }
    if (!Number.isFinite(totals.calories) || totals.calories <= 0 || totals.calories > enteredGrams * 10) {
      setError("Enter valid calories for this gram amount.");
      return;
    }
    if (Object.values(totals).some(value => !Number.isFinite(value) || value < 0)) {
      setError("Nutrition values cannot be negative.");
      return;
    }
    if ([totals.protein, totals.carbs, totals.fat, totals.fibre].some(value => value > enteredGrams)) {
      setError("Protein, carbs, fat and fibre cannot individually exceed the food’s total gram weight.");
      return;
    }

    const ratio = 100 / enteredGrams;
    const baseFood = {
      sourceType: "custom" as const,
      name: customName.trim().slice(0, 160),
      caloriesPer100g: totals.calories * ratio,
      proteinPer100g: totals.protein * ratio,
      carbsPer100g: totals.carbs * ratio,
      fatPer100g: totals.fat * ratio,
      fibrePer100g: totals.fibre * ratio,
      nutritionSource: `Manual entry · ${customName.trim().slice(0, 160)}`,
    };
    setSelectedFood({ ...baseFood, sourceKey: customFoodKey(baseFood) });
    setGrams(String(enteredGrams));
  }

  async function addFood(destination: "today" | "plan") {
    if (!selectedFood || !preview || adding) return;
    setAdding(true);
    setError("");
    const saved = await onAdd(selectedFood, preview.grams, destination);
    if (!saved) {
      setError("NutriPath could not complete this entry. Check the message above and try again.");
      setAdding(false);
    }
  }

  if (selectedFood) {
    return <div className="manual-food-editor">
      <button className="goals-back" type="button" onClick={() => { setSelectedFood(null); setError(""); }}>‹ Change food</button>
      <p className="eyebrow">MANUAL FOOD LOG</p>
      <h2>{selectedFood.name}</h2>
      {selectedFood.brandName && <p className="manual-brand">{selectedFood.brandName}</p>}
      <div className="manual-source"><strong>{selectedFood.sourceType === "usda" ? "USDA database" : selectedFood.sourceType === "nutrition_label" ? "Package nutrition label" : "Custom nutrition"}</strong><span>{selectedFood.nutritionSource}{selectedFood.fdcId ? ` · FDC ID ${selectedFood.fdcId}` : ""}</span></div>
      <label className="manual-grams"><span>Exact amount eaten</span><input type="number" inputMode="decimal" min="1" max="5000" step="0.1" value={grams} onChange={event => setGrams(event.target.value)} /><small>g</small></label>
      {preview
        ? <div className="manual-preview">
          <div className="manual-calories"><span>Calculated total</span><strong>{preview.calories}<small> kcal</small></strong></div>
          <div><span>Carbs</span><strong>{preview.carbs}g</strong></div>
          <div><span>Protein</span><strong>{preview.protein}g</strong></div>
          <div><span>Fat</span><strong>{preview.fat}g</strong></div>
          <div><span>Fibre</span><strong>{preview.fibre}g</strong></div>
        </div>
        : <div className="auth-error">Enter a gram amount between 1 and 5,000.</div>}
      {error && <div className="auth-error">{error}</div>}
      <div className="manual-add-actions"><button type="button" disabled={!preview || adding} onClick={() => addFood("today")}>{adding ? "Saving…" : "Add to Today"}</button><button type="button" disabled={!preview || adding} onClick={() => addFood("plan")}>Add to My Plan</button></div>
      <p className="goals-safety">Values are calculated from the selected per-100g source and the exact gram amount entered. Verify the selected food and preparation.</p>
    </div>;
  }

  return <div className="manual-food-editor">
    <p className="eyebrow">MANUAL FOOD LOG</p>
    <h2>Choose a food</h2>
    <p className="modal-sub">Search verified USDA records, reuse a saved food, or enter nutrition yourself.</p>
    <div className="segment manual-tabs">{[
      ["search", "Search USDA"],
      ["saved", "Saved"],
      ["custom", "Custom"],
    ].map(([value, label]) => <button type="button" key={value} className={mode === value ? "active" : ""} onClick={() => { setMode(value as "search" | "saved" | "custom"); setError(""); }}>{label}</button>)}</div>

    {mode === "search" && <>
      <form className="manual-search" onSubmit={searchFoods}><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Example: cooked brown rice" maxLength={80} /><button type="submit" disabled={searching}>{searching ? "Searching…" : "Search"}</button></form>
      <div className="manual-result-list">{results.map(food => <button type="button" key={food.sourceKey} onClick={() => chooseFood(food)}><span><strong>{food.name}</strong>{food.brandName && <small>{food.brandName}</small>}<em>{food.fdcId ? `USDA FDC ID ${food.fdcId}` : "USDA FoodData Central"}</em></span><b>{Math.round(food.caloriesPer100g)} kcal<small>per 100g</small></b></button>)}</div>
    </>}

    {mode === "saved" && <div className="manual-result-list">{savedFoods.length
      ? savedFoods.map(food => <button type="button" key={food.sourceKey} onClick={() => chooseFood(food)}><span><strong>{food.name}</strong><small>{food.sourceType === "nutrition_label" ? "Package nutrition label" : food.sourceType === "usda" ? "USDA FoodData Central" : "Custom entry"}</small>{food.timesUsed ? <em>Used {food.timesUsed} {food.timesUsed === 1 ? "time" : "times"}</em> : null}</span><b>{Math.round(food.caloriesPer100g)} kcal<small>per 100g</small></b></button>)
      : <div className="history-empty"><strong>No saved foods yet.</strong><span>Foods appear here after you log them or save a package nutrition label.</span></div>}</div>}

    {mode === "custom" && <form className="manual-custom-form" onSubmit={reviewCustomFood}>
      <label className="manual-custom-name"><span>Food name</span><input value={customName} onChange={event => setCustomName(event.target.value)} maxLength={160} placeholder="Example: Homemade protein bar" /></label>
      <label><span>Amount</span><input type="number" inputMode="decimal" min="1" max="5000" step="0.1" value={customGrams} onChange={event => setCustomGrams(event.target.value)} /><small>g</small></label>
      <label><span>Calories</span><input type="number" inputMode="decimal" min="1" step="1" value={customCalories} onChange={event => setCustomCalories(event.target.value)} /><small>kcal</small></label>
      <label><span>Carbs</span><input type="number" inputMode="decimal" min="0" step="0.1" value={customCarbs} onChange={event => setCustomCarbs(event.target.value)} /><small>g</small></label>
      <label><span>Protein</span><input type="number" inputMode="decimal" min="0" step="0.1" value={customProtein} onChange={event => setCustomProtein(event.target.value)} /><small>g</small></label>
      <label><span>Fat</span><input type="number" inputMode="decimal" min="0" step="0.1" value={customFat} onChange={event => setCustomFat(event.target.value)} /><small>g</small></label>
      <label><span>Fibre</span><input type="number" inputMode="decimal" min="0" step="0.1" value={customFibre} onChange={event => setCustomFibre(event.target.value)} /><small>g</small></label>
      <button className="primary full" type="submit">Review nutrition</button>
    </form>}
    {error && <div className="auth-error">{error}</div>}
  </div>;
}

export function WaterEditor({ water, goal, date, onAdd, onSetTotal, onSaveGoal }: {
  water: number;
  goal: number;
  date: string;
  onAdd: (amountMl: number) => Promise<string>;
  onSetTotal: (amountMl: number) => Promise<string>;
  onSaveGoal: (goalMl: number) => Promise<string>;
}) {
  const [customAmount, setCustomAmount] = useState("");
  const [correctedTotal, setCorrectedTotal] = useState(String(water));
  const [goalAmount, setGoalAmount] = useState(String(goal));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setCorrectedTotal(String(water)), [water]);
  useEffect(() => setGoalAmount(String(goal)), [goal]);

  async function run(action: () => Promise<string>, afterSave?: () => void) {
    if (saving) return;
    setSaving(true);
    setError("");
    const saveError = await action();
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    afterSave?.();
  }

  const selectedDateLabel = date === localDateKey()
    ? "today"
    : dateFromKey(date).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  const progress = goal > 0 ? Math.min(100, Math.round((water / goal) * 100)) : 0;

  return <div className="water-editor">
    <div className="modal-icon">♢</div>
    <p className="eyebrow">WATER</p>
    <h2>Water for {selectedDateLabel}</h2>
    <p className="modal-sub">Your water is saved to this date and restored when you refresh or sign in again.</p>

    <div className="water-status">
      <div><strong>{water.toLocaleString()}</strong><span>/ {goal.toLocaleString()} ml</span></div>
      <small>{progress}% of your daily goal</small>
      <i><b style={{ width: `${progress}%` }} /></i>
    </div>

    <div className="water-options" aria-label="Quick add water">
      {[250, 500, 750].map(amount => <button type="button" key={amount} disabled={saving} onClick={() => void run(() => onAdd(amount))}><strong>{amount}</strong><span>ml · Add</span></button>)}
    </div>

    <section className="water-edit-section">
      <div className="goals-section-title"><strong>Add another amount</strong><span>Enter the amount you just drank</span></div>
      <div className="water-input-action"><label><span>Amount</span><input type="number" inputMode="numeric" min="1" max={MAX_DAILY_WATER_ML} step="1" value={customAmount} onChange={event => setCustomAmount(event.target.value)} /><small>ml</small></label><button type="button" disabled={saving || !customAmount} onClick={() => void run(() => onAdd(Number(customAmount)), () => setCustomAmount(""))}>Add</button></div>
    </section>

    <section className="water-edit-section">
      <div className="goals-section-title"><strong>Correct this date’s total</strong><span>Use this if an earlier entry was wrong</span></div>
      <div className="water-input-action"><label><span>Exact total</span><input type="number" inputMode="numeric" min="0" max={MAX_DAILY_WATER_ML} step="1" value={correctedTotal} onChange={event => setCorrectedTotal(event.target.value)} /><small>ml</small></label><button type="button" disabled={saving || correctedTotal === ""} onClick={() => void run(() => onSetTotal(Number(correctedTotal)))}>Save total</button></div>
    </section>

    <section className="water-edit-section">
      <div className="goals-section-title"><strong>Daily water goal</strong><span>This target applies to every date</span></div>
      <div className="water-input-action"><label><span>Goal</span><input type="number" inputMode="numeric" min={MIN_WATER_GOAL_ML} max={MAX_WATER_GOAL_ML} step="50" value={goalAmount} onChange={event => setGoalAmount(event.target.value)} /><small>ml</small></label><button type="button" disabled={saving || goalAmount === ""} onClick={() => void run(() => onSaveGoal(Number(goalAmount)))}>Save goal</button></div>
    </section>

    {error && <div className="auth-error" role="alert">{error}</div>}
    <p className="goals-safety">Water needs vary. This is a personal tracking target, not a medical recommendation. If you have been given a fluid limit, follow your qualified health professional’s advice.</p>
  </div>;
}

