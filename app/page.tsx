"use client";

import { useEffect, useState } from "react";

type Tab = "today" | "plan" | "log" | "grocery" | "progress";
type Meal = { id: number; type: string; name: string; calories: number; protein: number; time: string; eaten: boolean; locked?: boolean; color: string };
type FoodAnalysis = {
  mealName: string;
  calories: { low: number; high: number; best: number };
  protein: number; carbs: number; fat: number; fibre: number;
  ingredients: { name: string; amount: string; calories: number }[];
  confidence: "High" | "Medium" | "Low";
  uncertainties: string[];
  clarifyingQuestions: string[];
  notes: string;
};
type ReviewIngredient = FoodAnalysis["ingredients"][number];
type MealReview = {
  ingredients: ReviewIngredient[];
  cookingFat: string;
  sauce: string;
};

const initialMeals: Meal[] = [
  { id: 1, type: "Breakfast", name: "Greek yoghurt fruit bowl", calories: 380, protein: 26, time: "8:00 AM", eaten: true, color: "berry" },
  { id: 2, type: "Lunch", name: "Turkey avocado wrap", calories: 510, protein: 38, time: "12:30 PM", eaten: true, locked: true, color: "wrap" },
  { id: 3, type: "Dinner", name: "Salmon & roasted vegetables", calories: 620, protein: 46, time: "6:30 PM", eaten: false, color: "salmon" },
  { id: 4, type: "Snack", name: "Apple with almond butter", calories: 210, protein: 6, time: "3:30 PM", eaten: false, color: "apple" },
];

const weekDays = [
  { day: "Mon", date: 6, value: 1720 }, { day: "Tue", date: 7, value: 1840 }, { day: "Wed", date: 8, value: 1610 },
  { day: "Thu", date: 9, value: 1775 }, { day: "Fri", date: 10, value: 1690 }, { day: "Sat", date: 11, value: 890 }, { day: "Sun", date: 12, value: 0 },
];

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "⌂" }, { id: "plan", label: "My Plan", icon: "▦" },
  { id: "log", label: "Log Food", icon: "+" }, { id: "grocery", label: "Grocery", icon: "✓" },
  { id: "progress", label: "Progress", icon: "↗" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [meals, setMeals] = useState(initialMeals);
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

  const consumed = meals.filter(m => m.eaten).reduce((sum, m) => sum + m.calories, 0);
  const protein = meals.filter(m => m.eaten).reduce((sum, m) => sum + m.protein, 0);
  const target = 1850;
  const pct = Math.min(100, Math.round((consumed / target) * 100));

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function markMeal(id: number) {
    setMeals(items => items.map(m => m.id === id ? { ...m, eaten: !m.eaten } : m));
    notify("Today’s progress updated");
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
    setUploadedPhoto(current => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setModal("scan");
    const sourceUrl = URL.createObjectURL(file);
    try {
      const source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("The source image could not be decoded."));
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
      setAnalysisError(error instanceof Error ? error.message : "This photo could not be prepared. Please choose another image.");
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function analyzePhoto(answers: string[] = [], review?: MealReview) {
    if (!uploadedData || analyzing) return;
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadedData, answers, previousAnalysis: analysis, review }),
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
      setAnalysis(payload.analysis);
      setModal(!review && answers.length === 0 && payload.analysis.clarifyingQuestions.length > 0 ? "clarify" : "result");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "The photo could not be analyzed.");
      setModal(review ? "result" : answers.length > 0 ? "clarify" : "scan");
    } finally {
      setAnalyzing(false);
    }
  }

  function addAnalyzedMeal() {
    if (!analysis) return;
    setMeals(items => [...items, {
      id: Date.now(), type: "Logged meal", name: analysis.mealName,
      calories: analysis.calories.best, protein: analysis.protein,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      eaten: true, color: "salmon",
    }]);
    setModal(null);
    setTab("today");
    notify(`${analysis.mealName} added to today`);
  }

  const title = tab === "today" ? "Today" : tab === "plan" ? "My Plan" : tab === "log" ? "Log Food" : tab === "grocery" ? "Grocery List" : "Progress";

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
          <div><p className="eyebrow">SATURDAY, 11 JULY</p><h1>{title}</h1></div>
          <button className="avatar" aria-label="Open profile" onClick={() => setModal("profile")}>GG</button>
        </header>

        <div className="content">
          {tab === "today" && <Today meals={meals} consumed={consumed} protein={protein} target={target} pct={pct} water={water} onMeal={markMeal} onWater={() => setModal("water")} onLog={() => setModal("log")} />}
          {tab === "plan" && <Plan meals={meals} onMeal={markMeal} notify={notify} />}
          {tab === "log" && <Log onPhoto={usePhoto} notify={notify} />}
          {tab === "grocery" && <Grocery checked={grocery} setChecked={setGrocery} notify={notify} />}
          {tab === "progress" && <Progress range={range} setRange={setRange} />}
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

function Today({ meals, consumed, protein, target, pct, water, onMeal, onWater, onLog }: any) {
  return <>
    <section className="hero-card">
      <div className="ring" style={{ "--progress": `${pct * 3.6}deg` } as React.CSSProperties}>
        <div><strong>{target - consumed}</strong><span>kcal left</span></div>
      </div>
      <div className="hero-copy"><span className="status-dot">On track</span><h2>{consumed.toLocaleString()} <small>of {target.toLocaleString()} kcal</small></h2><p>You’re building a balanced day.</p></div>
      <div className="macro-row">
        <ProgressPill label="Protein" value={`${protein} / 130g`} pct={Math.round(protein / 130 * 100)} />
        <ProgressPill label="Fibre" value="18 / 28g" pct={64} />
        <ProgressPill label="Water" value={`${(water / 1000).toFixed(1)} / 2.5L`} pct={water / 25} />
      </div>
    </section>

    <div className="quick-actions"><button className="primary" onClick={onLog}><span>＋</span> Add food</button><button onClick={onWater}><span>♢</span> Add water</button></div>

    <section className="section-block">
      <div className="section-heading"><div><p className="eyebrow">YOUR DAY</p><h2>Today’s meals</h2></div><span>{meals.filter((m: Meal) => m.eaten).length} of {meals.length} complete</span></div>
      <div className="meal-list">{meals.map((meal: Meal) => <MealCard key={meal.id} meal={meal} onMeal={onMeal} />)}</div>
    </section>

    <section className="insight-card"><div className="spark">✦</div><div><p className="eyebrow">TODAY’S INSIGHT</p><strong>A protein-rich dinner will bring you close to your daily target.</strong><p>Your planned salmon adds 46g of protein.</p></div></section>
  </>;
}

function ProgressPill({ label, value, pct }: { label: string; value: string; pct: number }) {
  return <div className="macro"><div><span>{label}</span><strong>{value}</strong></div><i><b style={{ width: `${Math.min(100, pct)}%` }} /></i></div>;
}

function MealCard({ meal, onMeal }: { meal: Meal; onMeal: (id: number) => void }) {
  return <article className={`meal-card ${meal.eaten ? "done" : ""}`}>
    <div className={`meal-image ${meal.color}`}><span>{meal.type === "Breakfast" ? "◒" : meal.type === "Lunch" ? "◐" : meal.type === "Dinner" ? "◑" : "●"}</span></div>
    <div className="meal-info"><div><span>{meal.type} · {meal.time}</span>{meal.locked && <em>Locked</em>}</div><h3>{meal.name}</h3><p>{meal.calories} kcal <b>·</b> {meal.protein}g protein</p></div>
    <button className={meal.eaten ? "check checked" : "check"} onClick={() => onMeal(meal.id)} aria-label={`Mark ${meal.name} ${meal.eaten ? "not eaten" : "eaten"}`}>{meal.eaten ? "✓" : ""}</button>
  </article>;
}

function Plan({ meals, onMeal, notify }: { meals: Meal[]; onMeal: (id: number) => void; notify: (s: string) => void }) {
  const days = ["Mon 6", "Tue 7", "Wed 8", "Thu 9", "Fri 10", "Sat 11", "Sun 12"];
  return <>
    <section className="plan-summary"><div><p className="eyebrow">7-DAY PLAN</p><h2>Weight loss · 1,850 kcal</h2><p>High protein, practical meals, ingredients reused thoughtfully.</p></div><button onClick={() => notify("Plan options opened")}>•••</button></section>
    <div className="date-strip">{days.map((d, i) => <button key={d} className={i === 5 ? "active" : ""}><span>{d.split(" ")[0]}</span><strong>{d.split(" ")[1]}</strong></button>)}</div>
    <div className="plan-toolbar"><span><b>Saturday</b> · 1,720 kcal planned</span><button onClick={() => notify("Day regenerated — locked meals kept")}>↻ Regenerate</button></div>
    <div className="meal-list plan-list">{meals.map(m => <div key={m.id} className="plan-meal"><MealCard meal={m} onMeal={onMeal} /><div className="plan-actions"><button onClick={() => notify("3 similar alternatives ready")}>Replace</button><button onClick={() => notify("Portion editor opened")}>Edit portion</button><button onClick={() => notify(m.locked ? "Meal unlocked" : "Meal locked")}>{m.locked ? "Unlock" : "Lock"}</button></div></div>)}</div>
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

function Progress({ range, setRange }: { range: string; setRange: (s: string) => void }) {
  return <>
    <div className="segment">{["Week", "Month", "3 months"].map(x => <button key={x} className={range === x ? "active" : ""} onClick={() => setRange(x)}>{x}</button>)}</div>
    <section className="weekly-win"><div className="spark">✦</div><div><p className="eyebrow">WEEKLY SUMMARY</p><h2>You’re finding your rhythm.</h2><p>You followed 78% of planned meals and reached your protein target on 5 of 7 days.</p></div></section>
    <section className="stats-grid"><div><span>Meal plan</span><strong>78%</strong><small>adherence <b>↑ 6%</b></small></div><div><span>Avg. calories</span><strong>1,726</strong><small>124 below target</small></div><div><span>Protein target</span><strong>5/7</strong><small>days reached</small></div><div><span>Water logged</span><strong>6/7</strong><small>days tracked</small></div></section>
    <section className="chart-card"><div className="section-heading"><div><p className="eyebrow">CALORIE CONSISTENCY</p><h2>Close to your target</h2></div><span>1,850 goal</span></div><div className="chart"><div className="goal-line"><span>Goal</span></div>{weekDays.map(d => <div className="bar-wrap" key={d.day}><div className={d.day === "Sat" ? "bar active" : "bar"} style={{ height: `${Math.max(8, d.value / 20)}px` }}><span>{d.value || "–"}</span></div><small>{d.day}</small></div>)}</div></section>
    <section className="weight-card"><div><p className="eyebrow">WEIGHT TREND</p><h2>77.4 kg</h2><span>↓ 0.8 kg since 14 June</span></div><div className="weight-line"><i /><b /><em /></div><button>＋ Add weight</button></section>
  </>;
}

function Modal({ type, close, addWater, next, notify, setTab, onPhoto, uploadedPhoto, uploadedData, analysis, analyzing, analysisError, onAnalyze, onAddAnalysis }: any) {
  const [answers, setAnswers] = useState<string[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewIngredient[]>([]);
  const [cookingFat, setCookingFat] = useState("Keep current estimate");
  const [sauce, setSauce] = useState("Keep current estimate");
  const [reviewDirty, setReviewDirty] = useState(false);

  useEffect(() => {
    if (type !== "result" || !analysis) return;
    setReviewItems(analysis.ingredients.map((item: ReviewIngredient) => ({ ...item })));
    setCookingFat("Keep current estimate");
    setSauce("Keep current estimate");
    setReviewDirty(false);
  }, [type, analysis]);

  function updateReviewItem(index: number, field: "name" | "amount", value: string) {
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
    setReviewDirty(true);
  }

  function removeReviewItem(index: number) {
    setReviewItems(items => items.filter((_, itemIndex) => itemIndex !== index));
    setReviewDirty(true);
  }

  function addReviewItem() {
    setReviewItems(items => [...items, { name: "", amount: "", calories: 0 }]);
    setReviewDirty(true);
  }

  function updateCookingFat(value: string) {
    setCookingFat(value);
    setReviewDirty(true);
  }

  function updateSauce(value: string) {
    setSauce(value);
    setReviewDirty(true);
  }

  function recalculateReview() {
    const ingredients = reviewItems
      .map(item => ({ ...item, name: item.name.trim(), amount: item.amount.trim() }))
      .filter(item => item.name);
    onAnalyze([], { ingredients, cookingFat, sauce });
  }

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><section className="modal-sheet">
    <button className="modal-close" onClick={close}>×</button>
    {type === "water" && <><div className="modal-icon">♢</div><p className="eyebrow">WATER</p><h2>Add to today</h2><p className="modal-sub">You’re at 1.5L of your 2.5L goal.</p><div className="water-options"><button onClick={() => addWater(250)}><strong>250</strong><span>ml · Glass</span></button><button onClick={() => addWater(500)}><strong>500</strong><span>ml · Bottle</span></button><button onClick={() => addWater(750)}><strong>750</strong><span>ml · Large bottle</span></button></div><button className="text-button">Enter a custom amount</button></>}
    {type === "log" && <><div className="modal-icon">＋</div><p className="eyebrow">ADD FOOD</p><h2>How would you like to log?</h2><div className="modal-photo-actions"><PhotoPicker label="Take a photo" capture="environment" onPhoto={onPhoto} /><PhotoPicker label="Upload from library" onPhoto={onPhoto} secondary /></div><div className="modal-list"><button onClick={() => { close(); setTab("log"); }}><i>⌕</i><span><strong>Search or scan</strong><small>Food, meals and barcodes</small></span><b>›</b></button><button onClick={() => notify("Previous meals opened")}><i>↻</i><span><strong>Choose a previous meal</strong><small>Quickly log it again</small></span><b>›</b></button></div></>}
    {type === "scan" && <><div className={`scan-frame ${uploadedPhoto ? "has-photo" : ""}`} style={uploadedPhoto ? { backgroundImage: `url(${uploadedPhoto})` } : undefined}>{!uploadedPhoto && <div className="scan-food"><span>Photo</span><span>Upload</span><span>Preview</span></div>}<b>✓ Photo uploaded successfully</b></div><p className="eyebrow">PHOTO ANALYSIS</p><h2>Your meal photo is ready</h2><p className="modal-sub">NutriPath will identify visible foods, estimate portions and nutrition, and ask up to two questions when important details are unclear.</p>{analysisError && <div className="connection-notice"><b>Analysis couldn’t start</b><span>{analysisError}</span></div>}<button className="primary full" disabled={!uploadedData || analyzing} onClick={() => onAnalyze()}>{analyzing ? "Analyzing your meal…" : uploadedData ? "Analyze this photo" : "Preparing photo…"}</button><button className="text-button" onClick={() => next("log")}>Choose a different photo</button></>}
    {type === "clarify" && analysis && <><span className="step-label">{analysis.clarifyingQuestions.length} quick {analysis.clarifyingQuestions.length === 1 ? "question" : "questions"}</span><div className="modal-icon">?</div><h2>A little detail will improve your estimate</h2><p className="modal-sub">NutriPath identified this as <b>{analysis.mealName}</b>, with {analysis.confidence.toLowerCase()} confidence.</p><div className="question-list">{analysis.clarifyingQuestions.map((question: string, index: number) => <label key={question}><span>{question}</span><input value={answers[index] || ""} onChange={event => setAnswers(current => { const updated = [...current]; updated[index] = event.target.value; return updated; })} placeholder="Type your answer, or ‘not sure’" /></label>)}</div>{analysisError && <div className="connection-notice"><b>Couldn’t refine estimate</b><span>{analysisError}</span></div>}<button className="primary full" disabled={analyzing || analysis.clarifyingQuestions.some((_: string, index: number) => !answers[index]?.trim())} onClick={() => onAnalyze(answers)}>{analyzing ? "Refining estimate…" : "Update my estimate"}</button><button className="text-button" onClick={() => next("result")}>Use current estimate</button></>}
    {type === "result" && analysis && <>
      <div className="confidence"><span>{analysis.confidence} confidence</span><b>Estimated</b></div>
      <p className="eyebrow">REVIEW MEAL</p>
      <h2>{analysis.mealName}</h2>
      <p className="analysis-notes">Check the foods and portions below. Correcting them before saving gives NutriPath a better calorie estimate.</p>
      <div className="estimate"><div><span>Estimated range</span><strong>{analysis.calories.low}–{analysis.calories.high} <small>kcal</small></strong></div><div><span>Best estimate</span><strong>{analysis.calories.best} <small>kcal</small></strong></div></div>
      <div className="result-macros"><span><b>{analysis.protein}g</b>Protein</span><span><b>{analysis.carbs}g</b>Carbs</span><span><b>{analysis.fat}g</b>Fat</span><span><b>{analysis.fibre}g</b>Fibre</span></div>
      {analysis.uncertainties.length > 0 && <div className="uncertainty"><b>✦ Main uncertainty</b><span>{analysis.uncertainties.join(" · ")}</span></div>}
      <div className="review-heading"><div><strong>Foods and portions</strong><span>Edit anything NutriPath got wrong</span></div><button onClick={addReviewItem}>＋ Add food</button></div>
      <div className="ingredient-review-list">
        {reviewItems.map((ingredient, index) => <div className="ingredient-review" key={index}>
          <label><span>Food</span><input value={ingredient.name} onChange={event => updateReviewItem(index, "name", event.target.value)} placeholder="Food name" /></label>
          <label><span>Portion</span><input value={ingredient.amount} onChange={event => updateReviewItem(index, "amount", event.target.value)} placeholder="e.g. 120 g or 1 cup" /></label>
          <div><span>{ingredient.calories > 0 ? `${ingredient.calories} kcal` : "New item"}</span><button aria-label={`Remove ${ingredient.name || "food"}`} onClick={() => removeReviewItem(index)}>Remove</button></div>
        </div>)}
      </div>
      <div className="extras-review">
        <label><span>Cooking oil or butter</span><select value={cookingFat} onChange={event => updateCookingFat(event.target.value)}><option>Keep current estimate</option><option>None used</option><option>1 teaspoon</option><option>2 teaspoons</option><option>1 tablespoon</option><option>2 or more tablespoons</option><option>Not sure</option></select></label>
        <label><span>Sauce or dressing</span><select value={sauce} onChange={event => updateSauce(event.target.value)}><option>Keep current estimate</option><option>None used</option><option>Light · about 1 tablespoon</option><option>Medium · about 2 tablespoons</option><option>Heavy · 3 or more tablespoons</option><option>Not sure</option></select></label>
      </div>
      {analysisError && <div className="connection-notice"><b>Couldn’t update estimate</b><span>{analysisError}</span></div>}
      {reviewDirty && <div className="review-changed"><span>Changes not calculated yet</span><button disabled={analyzing || !reviewItems.some(item => item.name.trim())} onClick={recalculateReview}>{analyzing ? "Recalculating…" : "Recalculate estimate"}</button></div>}
      {!reviewDirty && <button className="primary full" onClick={onAddAnalysis}>Add to today · {analysis.calories.best} kcal</button>}
      <p className="fine-print">Nutrition values are estimates. Verify ingredients, allergens and serving sizes.</p>
    </>}
    {type === "profile" && <><div className="profile-head"><div className="avatar big">GG</div><div><h2>Gabriel</h2><p>Weight loss · Metric units</p></div></div><div className="modal-list settings"><button><span><strong>Goals & targets</strong><small>1,850 kcal · 130g protein</small></span><b>›</b></button><button><span><strong>Dietary preferences</strong><small>No declared allergies</small></span><b>›</b></button><button><span><strong>Notifications</strong><small>All reminders off</small></span><b>›</b></button><button><span><strong>Subscription</strong><small>NutriPath Plus · Manage or cancel</small></span><b>›</b></button><button><span><strong>Privacy & your data</strong><small>Export or delete account</small></span><b>›</b></button></div><button className="text-button danger">Log out</button></>}
  </section></div>;
}
