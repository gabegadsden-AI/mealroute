"use client";

import { useEffect, useRef, useState } from "react";

type Tab = "today" | "plan" | "log" | "grocery" | "progress";
type Meal = { id: number; type: string; name: string; calories: number; protein: number; carbs: number; fat: number; time: string; eaten: boolean; locked?: boolean; color: string };
type LabelNutrition = { productName: string; energyValue: number; energyUnit: "kcal" | "kJ"; carbs: number; protein: number; fat: number; fibre: number };
type SavedPackagedProduct = LabelNutrition & { id: string; updatedAt: number };
type LabelNutritionDraft = Omit<LabelNutrition, "energyValue" | "carbs" | "protein" | "fat" | "fibre"> & { energyValue: number | ""; carbs: number | ""; protein: number | ""; fat: number | ""; fibre: number | "" };
type AnalysisIngredient = { name: string; amountGrams: number; calories: number; protein: number; carbs: number; fat: number; fibre: number; nutritionSource?: string; calculationSource?: "nutrition_label" | "usda"; fdcId?: number; labelNutrition?: LabelNutrition };
type FoodAnalysis = {
  mealName: string;
  calories: { low: number; high: number; best: number };
  protein: number; carbs: number; fat: number; fibre: number;
  ingredients: AnalysisIngredient[];
  confidence: "High" | "Medium" | "Low";
  uncertainties: string[];
  clarifyingQuestions: string[];
  notes: string;
  calculationMethod?: "verified_database" | "nutrition_label" | "mixed_sources" | "ai_estimate";
};
type ReviewIngredient = Omit<AnalysisIngredient, "amountGrams" | "labelNutrition"> & { amountGrams: number | ""; labelNutrition?: LabelNutritionDraft };
type MealReview = {
  ingredients: ReviewIngredient[];
};
type MealHistory = Record<string, Meal[]>;
type StoredMealHistory = { version: 2; days: MealHistory; planned: Meal[] };

const SAVED_PRODUCTS_KEY = "nutripath:saved-packaged-products:v1";
const DAILY_MEALS_KEY = "nutripath:daily-meals:v1";
const MEAL_HISTORY_KEY = "nutripath:meal-history:v2";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeStoredMeal(raw: any): Meal | null {
  if (!raw || !Number.isFinite(Number(raw.id)) || !String(raw.name || "").trim()) return null;
  const numbers = ["calories", "protein", "carbs", "fat"].map(key => Number(raw[key]));
  if (numbers.some(value => !Number.isFinite(value) || value < 0)) return null;
  return {
    id: Number(raw.id),
    type: String(raw.type || "Logged meal"),
    name: String(raw.name),
    calories: numbers[0],
    protein: numbers[1],
    carbs: numbers[2],
    fat: numbers[3],
    time: String(raw.time || ""),
    eaten: Boolean(raw.eaten),
    locked: raw.locked ? true : undefined,
    color: String(raw.color || "salmon"),
  };
}

function normalizeMealList(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeStoredMeal).filter((meal: Meal | null): meal is Meal => Boolean(meal));
}

function normalizeStoredHistory(raw: any): StoredMealHistory | null {
  if (raw?.version !== 2 || !raw.days || typeof raw.days !== "object" || Array.isArray(raw.days)) return null;
  const days: MealHistory = {};
  Object.entries(raw.days).forEach(([date, meals]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) days[date] = normalizeMealList(meals);
  });
  return { version: 2, days, planned: normalizeMealList(raw.planned) };
}

function persistMealHistory(days: MealHistory, planned: Meal[]) {
  try {
    const payload = JSON.stringify({ version: 2, days, planned });
    window.localStorage.setItem(MEAL_HISTORY_KEY, payload);
    return window.localStorage.getItem(MEAL_HISTORY_KEY) === payload;
  } catch {
    return false;
  }
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, Math.max(0, month - 1), day || 1);
}

function mealTotals(meals: Meal[]) {
  return meals.filter(meal => meal.eaten).reduce((totals, meal) => ({
    calories: totals.calories + meal.calories,
    protein: totals.protein + meal.protein,
    carbs: totals.carbs + meal.carbs,
    fat: totals.fat + meal.fat,
    count: totals.count + 1,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
}

function numericValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function nutritionValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round((number + Number.EPSILON) * 10) / 10) : 0;
}

function normalizeLabel(raw: any): LabelNutrition | undefined {
  if (!raw) return undefined;
  const values = [raw.energyValue, raw.carbs, raw.protein, raw.fat, raw.fibre].map(Number);
  if (!(values[0] > 0) || values.some(value => !Number.isFinite(value) || value < 0)) return undefined;
  return { productName: String(raw.productName || "Packaged food"), energyValue: values[0], energyUnit: raw.energyUnit === "kJ" ? "kJ" : "kcal", carbs: values[1], protein: values[2], fat: values[3], fibre: values[4] };
}

function gramValue(ingredient: any) {
  const direct = numericValue(ingredient?.amountGrams);
  if (direct > 0) return direct;
  const legacyMatch = String(ingredient?.amount || "").match(/\d+(?:\.\d+)?/);
  return legacyMatch ? Math.max(1, Math.round(Number(legacyMatch[0]))) : 0;
}

function normalizeAnalysis(raw: any, review?: MealReview): FoodAnalysis {
  const returnedIngredients = Array.isArray(raw?.ingredients) ? raw.ingredients : [];
  const ingredients = review
    ? review.ingredients.map((confirmed, index) => {
        const nameMatch = returnedIngredients.find((item: any) => String(item?.name || "").trim().toLowerCase() === confirmed.name.trim().toLowerCase());
        const calculated = nameMatch || returnedIngredients[index] || {};
        return {
          name: confirmed.name,
          amountGrams: confirmed.amountGrams,
          calories: numericValue(calculated.calories),
          protein: nutritionValue(calculated.protein), carbs: nutritionValue(calculated.carbs), fat: nutritionValue(calculated.fat), fibre: nutritionValue(calculated.fibre),
          nutritionSource: String(calculated.nutritionSource || confirmed.nutritionSource || "") || undefined,
          calculationSource: calculated.calculationSource || confirmed.calculationSource,
          fdcId: Number.isFinite(Number(calculated.fdcId ?? confirmed.fdcId)) ? Number(calculated.fdcId ?? confirmed.fdcId) : undefined,
          labelNutrition: normalizeLabel(calculated.labelNutrition || confirmed.labelNutrition),
        };
      })
    : returnedIngredients.map((ingredient: any) => ({
        name: String(ingredient?.name || "Food"),
        amountGrams: gramValue(ingredient),
        calories: numericValue(ingredient?.calories),
        protein: nutritionValue(ingredient?.protein), carbs: nutritionValue(ingredient?.carbs), fat: nutritionValue(ingredient?.fat), fibre: nutritionValue(ingredient?.fibre),
        nutritionSource: String(ingredient?.nutritionSource || "") || undefined, calculationSource: ingredient?.calculationSource,
        fdcId: Number.isFinite(Number(ingredient?.fdcId)) ? Number(ingredient.fdcId) : undefined, labelNutrition: normalizeLabel(ingredient?.labelNutrition),
      }));

  return {
    ...raw,
    mealName: String(raw?.mealName || "Scanned meal"),
    calories: {
      low: numericValue(raw?.calories?.low),
      high: numericValue(raw?.calories?.high),
      best: numericValue(raw?.calories?.best),
    },
    protein: nutritionValue(raw?.protein), carbs: nutritionValue(raw?.carbs), fat: nutritionValue(raw?.fat), fibre: nutritionValue(raw?.fibre),
    ingredients,
    confidence: ["High", "Medium", "Low"].includes(raw?.confidence) ? raw.confidence : "Low",
    uncertainties: Array.isArray(raw?.uncertainties) ? raw.uncertainties : [],
    clarifyingQuestions: Array.isArray(raw?.clarifyingQuestions) ? raw.clarifyingQuestions : [],
    notes: String(raw?.notes || ""),
    calculationMethod: ["verified_database", "nutrition_label", "mixed_sources"].includes(raw?.calculationMethod) ? raw.calculationMethod : "ai_estimate",
  };
}

const initialMeals: Meal[] = [
  { id: 1, type: "Breakfast", name: "Greek yoghurt fruit bowl", calories: 380, protein: 26, carbs: 48, fat: 10, time: "8:00 AM", eaten: true, color: "berry" },
  { id: 2, type: "Lunch", name: "Turkey avocado wrap", calories: 510, protein: 38, carbs: 44, fat: 20, time: "12:30 PM", eaten: true, locked: true, color: "wrap" },
  { id: 3, type: "Dinner", name: "Salmon & roasted vegetables", calories: 620, protein: 46, carbs: 38, fat: 28, time: "6:30 PM", eaten: false, color: "salmon" },
  { id: 4, type: "Snack", name: "Apple with almond butter", calories: 210, protein: 6, carbs: 24, fat: 11, time: "3:30 PM", eaten: false, color: "apple" },
];

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "⌂" }, { id: "plan", label: "My Plan", icon: "▦" },
  { id: "log", label: "Log Food", icon: "+" }, { id: "grocery", label: "Grocery", icon: "✓" },
  { id: "progress", label: "History", icon: "↗" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [mealHistory, setMealHistory] = useState<MealHistory>({});
  const [plannedMeals, setPlannedMeals] = useState<Meal[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [water, setWater] = useState(1500);
  const [modal, setModal] = useState<null | "water" | "log" | "scan" | "clarify" | "result" | "profile">(null);
  const [toast, setToast] = useState("");
  const [grocery, setGrocery] = useState<Record<string, boolean>>({ "Greek yoghurt": true, "Blueberries": true });
  const [range, setRange] = useState("Week");
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [uploadedData, setUploadedData] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const meals = selectedDate ? mealHistory[selectedDate] || [] : initialMeals;
  const totals = mealTotals(meals);
  const consumed = totals.calories;
  const protein = totals.protein;
  const carbs = totals.carbs;
  const fat = totals.fat;
  const target = 1850;
  const pct = Math.min(100, Math.round((consumed / target) * 100));

  useEffect(() => {
    try {
      const today = localDateKey();
      const storedHistory = normalizeStoredHistory(JSON.parse(window.localStorage.getItem(MEAL_HISTORY_KEY) || "null"));
      if (storedHistory) {
        setMealHistory(storedHistory.days);
        setPlannedMeals(storedHistory.planned);
        setSelectedDate(today);
        return;
      }

      const legacy = JSON.parse(window.localStorage.getItem(DAILY_MEALS_KEY) || "null");
      const legacyDate = /^\d{4}-\d{2}-\d{2}$/.test(String(legacy?.date || "")) ? String(legacy.date) : today;
      const legacyMeals = normalizeMealList(legacy?.meals);
      const migratedPlan = legacyMeals.filter(meal => meal.type === "Planned meal");
      const migratedDay = legacyMeals.filter(meal => meal.type !== "Planned meal");
      const days: MealHistory = legacyMeals.length ? { [legacyDate]: migratedDay } : { [today]: initialMeals };
      if (!days[today]) days[today] = [];
      if (persistMealHistory(days, migratedPlan)) window.localStorage.removeItem(DAILY_MEALS_KEY);
      setMealHistory(days);
      setPlannedMeals(migratedPlan);
      setSelectedDate(today);
    } catch {
      const today = localDateKey();
      const days = { [today]: initialMeals };
      setMealHistory(days);
      setPlannedMeals([]);
      setSelectedDate(today);
      persistMealHistory(days, []);
    }
  }, []);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function markMeal(id: number) {
    const date = selectedDate || localDateKey();
    const nextMeals = (mealHistory[date] || []).map(meal => meal.id === id ? { ...meal, eaten: !meal.eaten } : meal);
    const nextHistory = { ...mealHistory, [date]: nextMeals };
    setMealHistory(nextHistory);
    notify(persistMealHistory(nextHistory, plannedMeals) ? "This day’s progress updated and saved" : "Progress updated, but browser storage is unavailable");
  }

  function markPlannedMeal(id: number) {
    const nextPlan = plannedMeals.map(meal => meal.id === id ? { ...meal, eaten: !meal.eaten } : meal);
    setPlannedMeals(nextPlan);
    notify(persistMealHistory(mealHistory, nextPlan) ? "Planned meal updated and saved" : "Plan updated, but browser storage is unavailable");
  }

  function addWater(amount: number) {
    setWater(v => Math.min(3000, v + amount));
    setModal(null);
    notify(`${amount} ml of water added`);
  }

  async function usePhoto(file: File | undefined) {
    if (!file) return;
    setAnalysis(null);
    setAnalysisError("");
    setUploadedData(null);
    setModal("scan");
    let sourceUrl = "";
    try {
      const isHeic = /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
      let preparedFile: Blob = file;
      if (isHeic) {
        const { heicTo } = await import("heic-to/csp");
        preparedFile = await heicTo({ blob: file, type: "image/jpeg", quality: 0.86 });
      }
      setUploadedPhoto(current => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(preparedFile);
      });
      sourceUrl = URL.createObjectURL(preparedFile);
      const source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("This photo could not be decoded. Please choose a JPG, PNG, HEIC or HEIF image."));
        image.src = sourceUrl;
      });
      const maxDimension = 1400;
      const scale = Math.min(1, maxDimension / Math.max(source.naturalWidth, source.naturalHeight));
      const width = Math.max(1, Math.round(source.naturalWidth * scale));
      const height = Math.max(1, Math.round(source.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo processing is unavailable in this browser.");
      context.drawImage(source, 0, 0, width, height);
      setUploadedData(canvas.toDataURL("image/jpeg", 0.78));
    } catch (error) {
      const isHeic = /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
      setAnalysisError(error instanceof Error && !isHeic ? error.message : isHeic ? "This iPhone photo could not be converted. Please try Take a photo or upload a screenshot." : "This photo could not be prepared. Please choose another image.");
    } finally {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    }
  }

  async function analyzePhoto(answers: string[] = [], review?: MealReview) {
    if ((!uploadedData && !review) || analyzing) return;
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadedData, mode: review ? "review" : "analyze", answers, previousAnalysis: analysis, review }),
      });
      const responseText = await response.text();
      let payload: any;
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new Error(response.status === 413
          ? "This photo is still too large. Please move farther away and retake it."
          : `The analysis service returned an unexpected response (${response.status}). Please try again.`);
      }
      if (!response.ok) throw new Error(payload.error || "The photo could not be analyzed.");
      const nextAnalysis = normalizeAnalysis(payload.analysis, review);
      setAnalysis(nextAnalysis);
      setModal(!review && answers.length === 0 && nextAnalysis.clarifyingQuestions.length > 0 ? "clarify" : "result");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "The photo could not be analyzed.");
      setModal(review ? "result" : answers.length > 0 ? "clarify" : "scan");
    } finally {
      setAnalyzing(false);
    }
  }

  function addAnalyzedMeal(destination: "today" | "plan" = "today") {
    if (!analysis) return;
    const nextMeal = {
      id: Date.now(), type: destination === "today" ? "Logged meal" : "Planned meal", name: analysis.mealName,
      calories: analysis.calories.best, protein: analysis.protein, carbs: analysis.carbs, fat: analysis.fat,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      eaten: destination === "today", color: "salmon",
    };
    let saved = false;
    if (destination === "today") {
      const today = localDateKey();
      const nextHistory = { ...mealHistory, [today]: [...(mealHistory[today] || []), nextMeal] };
      setMealHistory(nextHistory);
      setSelectedDate(today);
      saved = persistMealHistory(nextHistory, plannedMeals);
    } else {
      const nextPlan = [...plannedMeals, nextMeal];
      setPlannedMeals(nextPlan);
      saved = persistMealHistory(mealHistory, nextPlan);
    }
    setModal(null);
    setTab(destination);
    notify(saved
      ? destination === "today" ? `${analysis.mealName} logged and saved on this device` : `${analysis.mealName} added to your plan and saved`
      : "Meal added, but browser storage is unavailable");
  }

  const selectedDateLabel = selectedDate ? dateFromKey(selectedDate).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) : "";
  const title = tab === "today" ? !selectedDate || selectedDate === localDateKey() ? "Today" : selectedDateLabel : tab === "plan" ? "My Plan" : tab === "log" ? "Log Food" : tab === "grocery" ? "Grocery List" : "History";

  return (
    <main className="app-shell">
      <div className="desktop-rail">
        <Brand />
        <p className="rail-kicker">Your nutrition, made simpler.</p>
        <div className="rail-nav">
          {navItems.map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span>{item.label}</button>)}
        </div>
        <div className="rail-quote"><span>“</span><p>Small choices add up. Keep going, Gabriel.</p></div>
      </div>

      <section className="phone-app">
        <header className="topbar">
          <div className="mobile-brand"><Brand /></div>
          <div><p className="eyebrow">{selectedDateLabel ? selectedDateLabel.toUpperCase() : "YOUR NUTRITION"}</p><h1>{title}</h1></div>
          <button className="avatar" aria-label="Open profile" onClick={() => setModal("profile")}>GG</button>
        </header>

        <div className="content">
          {tab === "today" && <Today meals={meals} selectedDate={selectedDate} onSelectDate={setSelectedDate} consumed={consumed} protein={protein} carbs={carbs} fat={fat} target={target} pct={pct} water={water} onMeal={markMeal} onWater={() => setModal("water")} onLog={() => setModal("log")} />}
          {tab === "plan" && <Plan meals={plannedMeals} onMeal={markPlannedMeal} notify={notify} />}
          {tab === "log" && <Log onPhoto={usePhoto} notify={notify} />}
          {tab === "grocery" && <Grocery checked={grocery} setChecked={setGrocery} notify={notify} />}
          {tab === "progress" && <Progress range={range} setRange={setRange} history={mealHistory} target={target} />}
        </div>

        <nav className="bottom-nav" aria-label="Main navigation">
          {navItems.map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}
        </nav>
      </section>

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
      {modal && <Modal type={modal} close={() => setModal(null)} addWater={addWater} next={setModal} notify={notify} setTab={setTab} onPhoto={usePhoto} uploadedPhoto={uploadedPhoto} uploadedData={uploadedData} analysis={analysis} analyzing={analyzing} analysisError={analysisError} onAnalyze={analyzePhoto} onAddAnalysis={addAnalyzedMeal} />}
    </main>
  );
}

function Brand() {
  return <div className="brand"><div className="brandmark">N</div><div><strong>NutriPath</strong><small>Plan better. Track simply. Eat your way.</small></div></div>;
}

function Today({ meals, selectedDate, onSelectDate, consumed, protein, carbs, fat, target, pct, water, onMeal, onWater, onLog }: any) {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  const dates = today ? Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index - 6);
    return date;
  }) : [];
  const selectedLabel = selectedDate
    ? selectedDate === (today ? localDateKey(today) : "") ? "Today’s meals" : `${dateFromKey(selectedDate).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })} meals`
    : "Today’s meals";
  return <>
    <section className="daily-overview">
      <div className="today-date-strip">
        {dates.length === 0 && Array.from({ length: 7 }, (_, index) => <button key={index} disabled><span>--</span><strong>--</strong></button>)}
        {dates.map(date => {
          const dateKey = localDateKey(date);
          const active = dateKey === selectedDate;
          return <button type="button" key={dateKey} className={active ? "active" : ""} onClick={() => onSelectDate(dateKey)}><span>{date.toLocaleDateString([], { weekday: "short" }).slice(0, 2)}</span><strong>{date.getDate()}</strong>{active && <i />}</button>;
        })}
      </div>
      <div className="calorie-readout">
        <div><strong>{consumed.toLocaleString()}</strong><span>/ {target.toLocaleString()}</span></div>
        <small>CALORIES EATEN</small>
        <p>{Math.max(0, target - consumed).toLocaleString()} kcal left today</p>
        <i><b style={{ width: `${pct}%` }} /></i>
      </div>
      <div className="daily-macro-grid">
        <MacroGoal kind="carbs" label="Carbs" value={carbs} goal={200} />
        <MacroGoal kind="protein" label="Protein" value={protein} goal={130} />
        <MacroGoal kind="fat" label="Fat" value={fat} goal={65} />
      </div>
      <div className="overview-actions"><button className="scan-meal" onClick={onLog}><span>＋</span><b>Scan or log meal</b></button><button onClick={onWater}><span>♢</span><b>{(water / 1000).toFixed(1)}L water</b></button></div>
    </section>

    <section className="section-block">
      <div className="section-heading history-heading"><div><p className="eyebrow">MEAL HISTORY</p><h2>{selectedLabel}</h2></div><input className="history-date-picker" aria-label="Choose meal history date" type="date" value={selectedDate} max={today ? localDateKey(today) : undefined} onChange={event => { if (event.target.value) onSelectDate(event.target.value); }} /></div>
      {meals.length > 0
        ? <><span className="history-count">{meals.filter((m: Meal) => m.eaten).length} of {meals.length} complete</span><div className="meal-list">{meals.map((meal: Meal) => <MealCard key={meal.id} meal={meal} onMeal={onMeal} />)}</div></>
        : <div className="history-empty"><strong>No meals logged for this date.</strong><span>Select another day or log a meal for today.</span><button onClick={onLog}>Log today’s meal</button></div>}
    </section>

    <section className="insight-card"><div className="spark">✦</div><div><p className="eyebrow">TODAY’S INSIGHT</p><strong>You have {Math.max(0, 130 - protein)}g of protein remaining.</strong><p>Your planned meals can help close the gap.</p></div></section>
  </>;
}

function MacroGoal({ kind, label, value, goal }: { kind: string; label: string; value: number; goal: number }) {
  return <div className={`macro-goal ${kind}`}><span>{label}</span><i><b style={{ width: `${Math.min(100, Math.round(value / goal * 100))}%` }} /></i><strong>{value}<small> / {goal}g</small></strong></div>;
}

function MealCard({ meal, onMeal }: { meal: Meal; onMeal: (id: number) => void }) {
  return <article className={`meal-card ${meal.eaten ? "done" : ""}`}>
    <div className={`meal-image ${meal.color}`}><span>{meal.type === "Breakfast" ? "◒" : meal.type === "Lunch" ? "◐" : meal.type === "Dinner" ? "◑" : "●"}</span></div>
    <div className="meal-info"><div><span>{meal.type} · {meal.time}</span>{meal.locked && <em>Locked</em>}</div><h3>{meal.name}</h3><p>{meal.calories} kcal <b>·</b> {meal.protein}g protein</p></div>
    <button className={meal.eaten ? "check checked" : "check"} onClick={() => onMeal(meal.id)} aria-label={`Mark ${meal.name} ${meal.eaten ? "not eaten" : "eaten"}`}>{meal.eaten ? "✓" : ""}</button>
  </article>;
}

function Plan({ meals, onMeal, notify }: { meals: Meal[]; onMeal: (id: number) => void; notify: (s: string) => void }) {
  const plannedCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
  return <>
    <section className="plan-summary"><div><p className="eyebrow">SAVED MEAL PLAN</p><h2>{meals.length} {meals.length === 1 ? "meal" : "meals"} · {plannedCalories.toLocaleString()} kcal</h2><p>Planned meals stay here across different days until you decide to use or replace them.</p></div><button onClick={() => notify("Plan options opened")}>•••</button></section>
    <div className="plan-toolbar"><span><b>Your reusable plan</b> · separate from food already eaten</span><button onClick={() => notify("Plan refreshed")}>↻ Refresh</button></div>
    {meals.length > 0
      ? <div className="meal-list plan-list">{meals.map(m => <div key={m.id} className="plan-meal"><MealCard meal={m} onMeal={onMeal} /><div className="plan-actions"><button onClick={() => notify("3 similar alternatives ready")}>Replace</button><button onClick={() => notify("Portion editor opened")}>Edit portion</button><button onClick={() => notify(m.locked ? "Meal unlocked" : "Meal locked")}>{m.locked ? "Unlock" : "Lock"}</button></div></div>)}</div>
      : <div className="history-empty"><strong>No meals in your plan yet.</strong><span>Analyze a meal and select Add to plan.</span></div>}
    <button className="wide-button" onClick={() => notify("Grocery list is up to date")}>Review grocery list <span>→</span></button>
  </>;
}

function PhotoPicker({ label, capture, onPhoto, secondary = false }: { label: string; capture?: "environment"; onPhoto: (file?: File) => void; secondary?: boolean }) {
  return <label className={`photo-picker ${secondary ? "secondary" : ""}`}>
    <input type="file" accept="image/*" capture={capture} onChange={event => onPhoto(event.target.files?.[0])} />
    <span>{capture ? "◎" : "▧"}</span>{label}
  </label>;
}

function Log({ onPhoto, notify }: { onPhoto: (file?: File) => void; notify: (s: string) => void }) {
  const methods = [
    ["◎", "Take a food photo", "Get an AI estimate with confidence and easy edits"], ["⌕", "Search food", "Find a meal, ingredient or restaurant item"],
    ["▣", "Scan a barcode", "Quickly add a packaged food"], ["✎", "Enter manually", "Add calories or build an ingredient list"],
  ];
  return <>
    <section className="log-hero"><div className="camera-orb">◎<i>✦</i></div><h2>What did you eat?</h2><p>Snap a photo and NutriPath will estimate the meal—then ask when details could make it more accurate.</p><div className="photo-actions"><PhotoPicker label="Take a photo" capture="environment" onPhoto={onPhoto} /><PhotoPicker label="Upload from library" onPhoto={onPhoto} secondary /></div><span>Nutrition values are always estimates.</span></section>
    <section className="method-grid">{methods.slice(1).map(([icon, title, sub]) => <button key={title} onClick={() => notify(`${title} opened`)}><i>{icon}</i><div><strong>{title}</strong><span>{sub}</span></div><b>›</b></button>)}</section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">QUICK ADD</p><h2>Recent meals</h2></div><button>View history</button></div>
      <div className="recent-row"><button onClick={() => notify("Tuna rice bowl added")}><span className="mini-food salmon" />Tuna rice bowl<small>540 kcal</small></button><button onClick={() => notify("Overnight oats added")}><span className="mini-food berry" />Overnight oats<small>410 kcal</small></button></div>
    </section>
  </>;
}

function Grocery({ checked, setChecked, notify }: any) {
  const groups: Record<string, string[]> = { Produce: ["Blueberries", "Apples", "Avocados", "Baby spinach", "Broccoli", "Capsicums"], "Meat & seafood": ["Chicken breast · 750g pack", "Salmon fillets · 4 pack", "Turkey slices · 300g"], "Dairy & eggs": ["Greek yoghurt", "Eggs · 12 pack", "Feta cheese"], Pantry: ["Brown rice · 1kg", "Black beans · 2 cans", "Almond butter", "Olive oil"] };
  const all = Object.values(groups).flat(); const count = all.filter(x => checked[x]).length;
  return <>
    <section className="grocery-head"><div className="grocery-icon">✓</div><div><p className="eyebrow">11–17 JULY</p><h2>{all.length} items for your plan</h2><p>{count} checked · Quantities combined into practical sizes.</p></div></section>
    <div className="grocery-progress"><i><b style={{ width: `${count / all.length * 100}%` }} /></i><span>{Math.round(count / all.length * 100)}%</span></div>
    {Object.entries(groups).map(([group, items]) => <section className="grocery-group" key={group}><div><h3>{group}</h3><span>{items.filter(x => checked[x]).length}/{items.length}</span></div>{items.map(item => <label key={item} className={checked[item] ? "checked" : ""}><input type="checkbox" checked={!!checked[item]} onChange={() => setChecked((v: any) => ({ ...v, [item]: !v[item] }))} /><i>{checked[item] ? "✓" : ""}</i><span>{item}</span><button onClick={e => { e.preventDefault(); notify(`${item} marked as already owned`); }}>•••</button></label>)}</section>)}
    <button className="wide-button subtle" onClick={() => notify("Owned items hidden")}>Remove anything you already have</button>
  </>;
}

function Progress({ range, setRange, history, target }: { range: string; setRange: (s: string) => void; history: MealHistory; target: number }) {
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
  const proteinTargetDays = trackedDays.filter(day => day.protein >= 130).length;
  const loggedMeals = trackedDays.reduce((sum, day) => sum + day.count, 0);
  const chartDays = periodTotals.slice(-7).map(day => ({
    key: day.date,
    day: dateFromKey(day.date).toLocaleDateString([], { weekday: "short" }),
    value: day.calories,
  }));
  return <>
    <div className="segment">{["Week", "Month", "3 months"].map(x => <button key={x} className={range === x ? "active" : ""} onClick={() => setRange(x)}>{x}</button>)}</div>
    <section className="weekly-win"><div className="spark">✦</div><div><p className="eyebrow">MEAL HISTORY</p><h2>{trackedDays.length ? `${trackedDays.length} ${trackedDays.length === 1 ? "day" : "days"} tracked.` : "Your history starts here."}</h2><p>{trackedDays.length ? `${loggedMeals} meals are saved in this ${range.toLowerCase()} view.` : "Log your first meal and NutriPath will build your calorie and macro history."}</p></div></section>
    <section className="stats-grid"><div><span>Days logged</span><strong>{trackedDays.length}</strong><small>of {rangeDays} days</small></div><div><span>Avg. calories</span><strong>{averageCalories.toLocaleString()}</strong><small>{averageCalories ? `${Math.abs(target - averageCalories).toLocaleString()} ${averageCalories <= target ? "below" : "above"} target` : "No entries yet"}</small></div><div><span>Protein target</span><strong>{proteinTargetDays}/{trackedDays.length || 0}</strong><small>tracked days reached</small></div><div><span>Meals logged</span><strong>{loggedMeals}</strong><small>confirmed as eaten</small></div></section>
    <section className="chart-card"><div className="section-heading"><div><p className="eyebrow">LAST 7 DAYS</p><h2>Calories by day</h2></div><span>{target.toLocaleString()} goal</span></div><div className="chart"><div className="goal-line"><span>Goal</span></div>{chartDays.map(day => <div className="bar-wrap" key={day.key}><div className={day.key === (today ? localDateKey(today) : "") ? "bar active" : "bar"} style={{ height: `${Math.max(8, Math.min(110, day.value / 20))}px` }}><span>{day.value || "–"}</span></div><small>{day.day}</small></div>)}</div></section>
    <section className="weight-card"><div><p className="eyebrow">HISTORY STATUS</p><h2>{trackedDays.length} saved {trackedDays.length === 1 ? "day" : "days"}</h2><span>Stored on this browser and restored after refresh.</span></div><div className="weight-line"><i /><b /><em /></div></section>
  </>;
}

function Modal({ type, close, addWater, next, notify, setTab, onPhoto, uploadedPhoto, uploadedData, analysis, analyzing, analysisError, onAnalyze, onAddAnalysis }: any) {
  const [answers, setAnswers] = useState<string[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewIngredient[]>([]);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [fixingResult, setFixingResult] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmedUpdate, setConfirmedUpdate] = useState(false);
  const [savedProducts, setSavedProducts] = useState<SavedPackagedProduct[]>([]);
  const confirmedReviewRef = useRef<ReviewIngredient[] | null>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(SAVED_PRODUCTS_KEY) || "[]");
      if (Array.isArray(parsed)) setSavedProducts(parsed.filter(item => item?.id && item?.productName));
    } catch {
      setSavedProducts([]);
    }
  }, []);

  useEffect(() => {
    if (type !== "result" || !analysis) return;
    const confirmed = confirmedReviewRef.current;
    if (confirmed) {
      saveLabelProfiles(confirmed);
      setReviewItems(confirmed.map((ingredient, index) => {
        const recalculated = analysis.ingredients[index] || ingredient;
        return {
          ...recalculated,
          name: ingredient.name,
          amountGrams: ingredient.amountGrams,
        };
      }));
      confirmedReviewRef.current = null;
      setConfirmedUpdate(true);
    } else {
      setReviewItems(analysis.ingredients.map((item: ReviewIngredient) => ({ ...item })));
      setConfirmedUpdate(false);
    }
    setReviewDirty(false);
    setFixingResult(false);
    setEditingIndex(null);
  }, [type, analysis]);

  function saveLabelProfiles(ingredients: ReviewIngredient[]) {
    const labels = ingredients.filter(item => item.labelNutrition && labelIsComplete(item)).map(item => {
      const label = item.labelNutrition!;
      return {
        id: label.productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `product-${Date.now()}`,
        productName: label.productName.trim(),
        energyValue: Number(label.energyValue), energyUnit: label.energyUnit,
        carbs: Number(label.carbs), protein: Number(label.protein), fat: Number(label.fat), fibre: Number(label.fibre), updatedAt: Date.now(),
      } satisfies SavedPackagedProduct;
    });
    if (!labels.length) return;
    setSavedProducts(current => {
      const next = [...current];
      labels.forEach(label => {
        const index = next.findIndex(item => item.id === label.id);
        if (index >= 0) next[index] = label; else next.unshift(label);
      });
      const limited = next.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
      window.localStorage.setItem(SAVED_PRODUCTS_KEY, JSON.stringify(limited));
      return limited;
    });
  }

  function updateReviewName(index: number, value: string) {
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: value, fdcId: undefined, nutritionSource: undefined, calculationSource: undefined } : item));
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function togglePackageLabel(index: number, enabled: boolean) {
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, fdcId: undefined, nutritionSource: undefined, calculationSource: undefined, labelNutrition: enabled ? { productName: item.name || "Packaged food", energyValue: "", energyUnit: "kJ", carbs: "", protein: "", fat: "", fibre: "" } : undefined } : item));
    setReviewDirty(true); setConfirmedUpdate(false);
  }

  function selectSavedProduct(index: number, productId: string) {
    const product = savedProducts.find(item => item.id === productId);
    if (!product) return;
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      name: item.name || product.productName,
      fdcId: undefined,
      nutritionSource: undefined,
      calculationSource: undefined,
      labelNutrition: { productName: product.productName, energyValue: product.energyValue, energyUnit: product.energyUnit, carbs: product.carbs, protein: product.protein, fat: product.fat, fibre: product.fibre },
    } : item));
    setReviewDirty(true); setConfirmedUpdate(false);
  }

  function updateLabelField(index: number, field: keyof LabelNutritionDraft, rawValue: string) {
    setReviewItems(items => items.map((item, itemIndex) => {
      if (itemIndex !== index || !item.labelNutrition) return item;
      const value = field === "productName" || field === "energyUnit" ? rawValue : rawValue === "" ? "" : Math.max(0, Number(rawValue));
      return { ...item, labelNutrition: { ...item.labelNutrition, [field]: value } as LabelNutritionDraft };
    }));
    setReviewDirty(true); setConfirmedUpdate(false);
  }

  function labelIsComplete(item: ReviewIngredient) {
    const label = item.labelNutrition;
    if (!label) return true;
    const rawValues = [label.energyValue, label.carbs, label.protein, label.fat, label.fibre];
    if (rawValues.some(value => value === "")) return false;
    const values = rawValues.map(Number);
    return Boolean(label.productName.trim() && values[0] > 0 && values.every(value => Number.isFinite(value) && value >= 0));
  }

  function reviewValidationMessage() {
    if (reviewItems.length === 0) return "Add at least one ingredient.";
    if (reviewItems.some(item => !item.name.trim())) return "Enter a food name for every ingredient.";
    if (reviewItems.some(item => Number(item.amountGrams) <= 0)) return "Enter a gram amount greater than zero.";
    const incompleteLabel = reviewItems.find(item => item.labelNutrition && !labelIsComplete(item));
    if (incompleteLabel) return `Complete every package-label field for ${incompleteLabel.labelNutrition?.productName || incompleteLabel.name}. Light example text is not saved data.`;
    return "";
  }

  function updateReviewGrams(index: number, value: string) {
    const amountGrams = value === "" ? "" : Math.min(5000, Math.max(1, Math.round(Number(value) || 1)));
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, amountGrams } : item));
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function removeReviewItem(index: number) {
    setReviewItems(items => items.filter((_, itemIndex) => itemIndex !== index));
    setEditingIndex(null);
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function addReviewItem() {
    setReviewItems(items => [...items, { name: "", amountGrams: "", calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }]);
    setEditingIndex(reviewItems.length);
    setFixingResult(true);
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function recalculateReview() {
    const ingredients = reviewItems
      .map(item => ({ ...item, name: item.name.trim(), amountGrams: Number(item.amountGrams), labelNutrition: item.labelNutrition ? { productName: item.labelNutrition.productName.trim(), energyValue: Number(item.labelNutrition.energyValue), energyUnit: item.labelNutrition.energyUnit, carbs: Number(item.labelNutrition.carbs), protein: Number(item.labelNutrition.protein), fat: Number(item.labelNutrition.fat), fibre: Number(item.labelNutrition.fibre) } : undefined }))
      .filter(item => item.name && item.amountGrams > 0) as ReviewIngredient[];
    confirmedReviewRef.current = ingredients.map(ingredient => ({ ...ingredient }));
    setReviewItems(ingredients.map(ingredient => ({ ...ingredient })));
    onAnalyze([], { ingredients });
  }

  const reviewProblem = reviewDirty ? reviewValidationMessage() : "";

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><section className={`modal-sheet ${type === "result" ? "result-sheet" : ""}`}>
    <button className="modal-close" onClick={close}>×</button>
    {type === "water" && <><div className="modal-icon">♢</div><p className="eyebrow">WATER</p><h2>Add to today</h2><p className="modal-sub">You’re at 1.5L of your 2.5L goal.</p><div className="water-options"><button onClick={() => addWater(250)}><strong>250</strong><span>ml · Glass</span></button><button onClick={() => addWater(500)}><strong>500</strong><span>ml · Bottle</span></button><button onClick={() => addWater(750)}><strong>750</strong><span>ml · Large bottle</span></button></div><button className="text-button">Enter a custom amount</button></>}
    {type === "log" && <><div className="modal-icon">＋</div><p className="eyebrow">ADD FOOD</p><h2>How would you like to log?</h2><div className="modal-photo-actions"><PhotoPicker label="Take a photo" capture="environment" onPhoto={onPhoto} /><PhotoPicker label="Upload from library" onPhoto={onPhoto} secondary /></div><div className="modal-list"><button onClick={() => { close(); setTab("log"); }}><i>⌕</i><span><strong>Search or scan</strong><small>Food, meals and barcodes</small></span><b>›</b></button><button onClick={() => notify("Previous meals opened")}><i>↻</i><span><strong>Choose a previous meal</strong><small>Quickly log it again</small></span><b>›</b></button></div></>}
    {type === "scan" && <><div className={`scan-frame ${uploadedPhoto ? "has-photo" : ""}`} style={uploadedPhoto ? { backgroundImage: `url(${uploadedPhoto})` } : undefined}>{!uploadedPhoto && <div className="scan-food"><span>Photo</span><span>Upload</span><span>Preview</span></div>}<b>✓ Photo uploaded successfully</b></div><p className="eyebrow">PHOTO ANALYSIS</p><h2>Your meal photo is ready</h2><p className="modal-sub">NutriPath will identify visible foods, estimate portions and nutrition, and ask up to two questions when important details are unclear.</p>{analysisError && <div className="connection-notice"><b>Analysis couldn’t start</b><span>{analysisError}</span></div>}<button className="primary full" disabled={!uploadedData || analyzing} onClick={() => onAnalyze()}>{analyzing ? "Analyzing your meal…" : uploadedData ? "Analyze this photo" : "Preparing photo…"}</button><button className="text-button" onClick={() => next("log")}>Choose a different photo</button></>}
    {type === "clarify" && analysis && <><span className="step-label">{analysis.clarifyingQuestions.length} quick {analysis.clarifyingQuestions.length === 1 ? "question" : "questions"}</span><div className="modal-icon">?</div><h2>A little detail will improve your estimate</h2><p className="modal-sub">NutriPath identified this as <b>{analysis.mealName}</b>, with {analysis.confidence.toLowerCase()} confidence.</p><div className="question-list">{analysis.clarifyingQuestions.map((question: string, index: number) => <label key={question}><span>{question}</span><input value={answers[index] || ""} onChange={event => setAnswers(current => { const updated = [...current]; updated[index] = event.target.value; return updated; })} placeholder="Type your answer, or ‘not sure’" /></label>)}</div>{analysisError && <div className="connection-notice"><b>Couldn’t refine estimate</b><span>{analysisError}</span></div>}<button className="primary full" disabled={analyzing || analysis.clarifyingQuestions.some((_: string, index: number) => !answers[index]?.trim())} onClick={() => onAnalyze(answers)}>{analyzing ? "Refining estimate…" : "Update my estimate"}</button><button className="text-button" onClick={() => next("result")}>Use current estimate</button></>}
    {type === "result" && analysis && <>
      <div className={`result-photo ${uploadedPhoto ? "has-photo" : ""}`} style={uploadedPhoto ? { backgroundImage: `url(${uploadedPhoto})` } : undefined}>
        <div><span>{analysis.confidence} confidence</span><b>{analysis.calculationMethod === "nutrition_label" ? "Nutrition label calculation" : analysis.calculationMethod === "mixed_sources" ? "Mixed-source calculation" : analysis.calculationMethod === "verified_database" ? "Database calculation" : "AI estimate"}</b></div>
      </div>
      <div className="result-content">
        <div className="result-title-row"><div><p>SCANNED MEAL</p><h2>{analysis.mealName}</h2></div><button aria-label="Save meal for later">♡</button></div>
        <div className="calorie-summary"><strong>{analysis.calories.best}</strong><span>kcal</span><small>{analysis.calculationMethod && analysis.calculationMethod !== "ai_estimate" ? "Calculated from confirmed grams" : `${analysis.calories.low}–${analysis.calories.high} estimated range`}</small></div>
        <div className="result-macro-cards">
          <div className="carbs"><span>Carbs</span><strong>{analysis.carbs}g</strong></div>
          <div className="protein"><span>Protein</span><strong>{analysis.protein}g</strong></div>
          <div className="fat"><span>Fat</span><strong>{analysis.fat}g</strong></div>
        </div>
        {analysis.fibre > 0 && <div className="fibre-summary"><span>Fibre</span><strong>{analysis.fibre}g</strong><small>Shown separately from carbohydrates</small></div>}
        {confirmedUpdate && <div className="result-updated">✓ Changes saved — confirmed grams retained</div>}
        {analysis.uncertainties.length > 0 && <div className="result-uncertainty"><b>Estimate note</b><span>{analysis.uncertainties.join(" · ")}</span></div>}
        <div className="result-section-heading"><div><h3>Ingredients</h3><span>{reviewItems.length} detected</span></div><button className={fixingResult ? "active" : ""} onClick={() => { setFixingResult(value => !value); setEditingIndex(null); }}>{fixingResult ? "Done" : "Fix result"}</button></div>
        <div className="result-ingredient-list">
          {reviewItems.map((ingredient, index) => <div className="result-ingredient" key={index}>
            <div className="ingredient-summary">
              <button className="ingredient-main" disabled={!fixingResult} onClick={() => setEditingIndex(editingIndex === index ? null : index)}>
                <strong>{ingredient.name || "New ingredient"}</strong>
                <span>{ingredient.amountGrams ? `${ingredient.amountGrams} g` : "Add grams"} · {ingredient.calories} kcal</span>
                <small><i>C {ingredient.carbs}g</i><i>P {ingredient.protein}g</i><i>F {ingredient.fat}g</i></small>
                {ingredient.nutritionSource && <em className="ingredient-source">Source · {ingredient.nutritionSource}{ingredient.fdcId ? ` · FDC ID ${ingredient.fdcId}` : ""}</em>}
                {ingredient.calculationSource === "usda" && <em className="packaged-food-hint">Packaged product? Select Edit, then “Use package nutrition label” for the exact brand values.</em>}
              </button>
              {fixingResult && <button className="ingredient-edit-trigger" onClick={() => setEditingIndex(editingIndex === index ? null : index)}>{editingIndex === index ? "−" : "Edit"}</button>}
            </div>
            {fixingResult && editingIndex === index && <div className="ingredient-inline-editor">
              <label><span>Food</span><input value={ingredient.name} onChange={event => updateReviewName(index, event.target.value)} placeholder="Food name" /></label>
              <label><span>Grams</span><input type="number" inputMode="numeric" min="1" max="5000" step="1" value={ingredient.amountGrams} onChange={event => updateReviewGrams(index, event.target.value)} placeholder="120" /><small className="gram-unit">g</small></label>
              {savedProducts.length > 0 && <label className="saved-product-picker"><span>Saved packaged product</span><select value="" onChange={event => selectSavedProduct(index, event.target.value)}><option value="">Choose a saved product</option>{savedProducts.map(product => <option key={product.id} value={product.id}>{product.productName}</option>)}</select><small>Loads the saved per-100 g label values. You only need to confirm the portion grams.</small></label>}
              <label className="package-label-toggle"><input type="checkbox" checked={Boolean(ingredient.labelNutrition)} onChange={event => togglePackageLabel(index, event.target.checked)} /><span>Use package nutrition label</span></label>
              {ingredient.labelNutrition && <div className="package-label-fields">
                <div className="package-label-heading"><strong>Required values per 100 g</strong><small>Type every figure exactly as printed on the package.</small></div>
                <label className="product-name"><span>Product name</span><input value={ingredient.labelNutrition.productName} onChange={event => updateLabelField(index, "productName", event.target.value)} placeholder="Enter product name" /></label>
                <label><span>Energy</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.energyValue} onChange={event => updateLabelField(index, "energyValue", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Unit</span><select value={ingredient.labelNutrition.energyUnit} onChange={event => updateLabelField(index, "energyUnit", event.target.value)}><option value="kJ">kJ</option><option value="kcal">kcal</option></select></label>
                <label><span>Carbs (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.carbs} onChange={event => updateLabelField(index, "carbs", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Protein (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.protein} onChange={event => updateLabelField(index, "protein", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Fat (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.fat} onChange={event => updateLabelField(index, "fat", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Fibre (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.fibre} onChange={event => updateLabelField(index, "fibre", event.target.value)} placeholder="Enter value" /></label>
              </div>}
              <button onClick={() => removeReviewItem(index)}>Remove ingredient</button>
            </div>}
          </div>)}
        </div>
        {fixingResult && <>
          <button className="add-ingredient" onClick={addReviewItem}>＋ Add new ingredient</button>
          <details className="hidden-calories"><summary>Oil, butter, sauces <span>Add exact grams</span></summary><p>If one is missing, select “Add new ingredient,” enter its name, then enter the grams used. NutriPath will calculate it with the rest of the confirmed meal.</p></details>
        </>}
        {analysisError && <div className="connection-notice"><b>Couldn’t update estimate</b><span>{analysisError}</span></div>}
        {reviewProblem && <div className="review-validation-hint"><b>Complete the required fields</b><span>{reviewProblem}</span></div>}
        <div className="result-actions">
          {reviewDirty ? <button className="update-result" disabled={analyzing || Boolean(reviewProblem)} onClick={recalculateReview}>{analyzing ? "Recalculating confirmed foods…" : "Update nutrition"}</button> : <><button className="log-result" onClick={() => onAddAnalysis("today")}>Log meal · {analysis.calories.best} kcal</button><button className="plan-result" onClick={() => onAddAnalysis("plan")}>Add to plan</button></>}
        </div>
        <p className="fine-print">Package-label values are calculated exactly from the figures you enter. USDA values remain estimates and can vary by product and preparation. Verify ingredients, allergens and serving sizes. USDA does not endorse NutriPath.</p>
      </div>
    </>}
    {type === "profile" && <><div className="profile-head"><div className="avatar big">GG</div><div><h2>Gabriel</h2><p>Weight loss · Metric units</p></div></div><div className="modal-list settings"><button><span><strong>Goals & targets</strong><small>1,850 kcal · 130g protein</small></span><b>›</b></button><button><span><strong>Dietary preferences</strong><small>No declared allergies</small></span><b>›</b></button><button><span><strong>Notifications</strong><small>All reminders off</small></span><b>›</b></button><button><span><strong>Subscription</strong><small>NutriPath Plus · Manage or cancel</small></span><b>›</b></button><button><span><strong>Privacy & your data</strong><small>Export or delete account</small></span><b>›</b></button></div><button className="text-button danger">Log out</button></>}
  </section></div>;
}
