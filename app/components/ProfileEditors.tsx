"use client";
import { useState, useMemo } from "react";
import { type MealRouteProfile } from "../../lib/profile";
import { type ProfileGoalUpdate, type ProfileMacroUpdate, type ProfileDietaryUpdate, type ProfileNotificationsUpdate } from "../../lib/app-utils";
import { type MacroTargets, macroCalories, macroPercentages, suggestedMacroTargets } from "../../lib/macro-targets";
import { activityLabels, cmToImperial, goalLabels, suggestedCalories, type Activity, type Goal } from "../../lib/calorie-goal";

export function Brand() {
  return <div className="brand"><div className="brandmark">M</div><div><strong>MealRoute</strong><small>Plan your meals. Track your way.</small></div></div>;
}

export function profileInitials(name?: string | null) {
  const initials = String(name || "MealRoute")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("");
  return initials || "NP";
}

export function profileGoalLabel(goal?: MealRouteProfile["primary_goal"]) {
  if (goal === "lose_weight") return "Lose weight";
  if (goal === "build_muscle") return "Build muscle";
  if (goal === "eat_healthier") return "Eat healthier";
  if (goal === "maintain_weight") return "Maintain weight";
  return "Nutrition goal";
}

export function GoalsEditor({
  profile,
  onBack,
  onSave,
}: {
  profile: MealRouteProfile;
  onBack: () => void;
  onSave: (values: ProfileGoalUpdate) => Promise<string>;
}) {
  const initialImperialHeight = cmToImperial(profile.height_cm);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">(profile.weight_unit || "kg");
  const [weight, setWeight] = useState(profile.weight_kg
    ? String(profile.weight_unit === "lb" ? Math.round(profile.weight_kg * 2.20462 * 10) / 10 : profile.weight_kg)
    : "");
  const [heightUnit, setHeightUnit] = useState<"cm" | "imperial">(profile.height_unit || "cm");
  const [heightCm, setHeightCm] = useState(profile.height_cm ? String(profile.height_cm) : "");
  const [feet, setFeet] = useState(initialImperialHeight.feet);
  const [inches, setInches] = useState(initialImperialHeight.inches);
  const [goal, setGoal] = useState<Goal | "">(profile.primary_goal || "");
  const [activity, setActivity] = useState<Activity | "">(profile.activity_level || "");
  const [calorieGoal, setCalorieGoal] = useState(profile.calorie_goal ? String(profile.calorie_goal) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const normalizedWeight = useMemo(() => {
    const value = Number(weight);
    return weightUnit === "lb" ? value / 2.20462 : value;
  }, [weight, weightUnit]);

  const normalizedHeight = useMemo(() => {
    if (heightUnit === "cm") return Number(heightCm);
    return (Number(feet) * 12 + Number(inches)) * 2.54;
  }, [heightCm, heightUnit, feet, inches]);

  const suggested = useMemo(() => {
    if (
      !(normalizedWeight > 0)
      || !(normalizedHeight > 0)
      || !(Number(profile.age) >= 18)
      || !profile.calculation_sex
      || !activity
      || !goal
    ) return 0;
    return suggestedCalories(
      normalizedWeight,
      normalizedHeight,
      Number(profile.age),
      profile.calculation_sex,
      activity,
      goal,
    );
  }, [normalizedWeight, normalizedHeight, profile.age, profile.calculation_sex, activity, goal]);

  const validationError = useMemo(() => {
    if (!(normalizedWeight >= 30 && normalizedWeight <= 350)) return "Enter a weight between 30 and 350 kg (66 and 772 lb).";
    if (!(normalizedHeight >= 120 && normalizedHeight <= 230)) return "Enter a height between 120 and 230 cm.";
    if (!goal) return "Select your primary goal.";
    if (!activity) return "Select your activity level.";
    const target = Number(calorieGoal);
    if (!(target >= 1200 && target <= 6000)) return "Enter a daily calorie target between 1,200 and 6,000 kcal.";
    return "";
  }, [normalizedWeight, normalizedHeight, goal, activity, calorieGoal]);

  function changeWeightUnit(nextUnit: "kg" | "lb") {
    if (nextUnit === weightUnit) return;
    const current = Number(weight);
    if (current > 0) {
      const converted = nextUnit === "lb" ? current * 2.20462 : current / 2.20462;
      setWeight(String(Math.round(converted * 10) / 10));
    }
    setWeightUnit(nextUnit);
  }

  function changeHeightUnit(nextUnit: "cm" | "imperial") {
    if (nextUnit === heightUnit) return;
    if (nextUnit === "imperial") {
      const converted = cmToImperial(Number(heightCm) || null);
      setFeet(converted.feet);
      setInches(converted.inches);
    } else {
      const converted = (Number(feet) * 12 + Number(inches)) * 2.54;
      if (converted > 0) setHeightCm(String(Math.round(converted * 10) / 10));
    }
    setHeightUnit(nextUnit);
  }

  async function save() {
    if (validationError || !goal || !activity) {
      setError(validationError || "Complete every required field.");
      return;
    }
    setSaving(true);
    setError("");
    const saveError = await onSave({
      weight_kg: Math.round(normalizedWeight * 10) / 10,
      height_cm: Math.round(normalizedHeight * 10) / 10,
      weight_unit: weightUnit,
      height_unit: heightUnit,
      primary_goal: goal,
      activity_level: activity,
      suggested_calorie_goal: suggested || null,
      calorie_goal: Number(calorieGoal),
    });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onBack();
  }

  return <div className="goals-editor">
    <button className="goals-back" type="button" onClick={onBack}>‹ Profile</button>
    <p className="eyebrow">GOALS & TARGETS</p>
    <h2>Update your nutrition settings</h2>
    <p className="modal-sub">Changes are saved to your account and update the dashboard immediately.</p>

    <section className="goals-section">
      <div className="goals-section-title"><strong>Weight</strong><span>Used for your calorie estimate</span></div>
      <div className="goals-unit-row">
        <div className="goals-unit-toggle"><button type="button" className={weightUnit === "kg" ? "active" : ""} onClick={() => changeWeightUnit("kg")}>kg</button><button type="button" className={weightUnit === "lb" ? "active" : ""} onClick={() => changeWeightUnit("lb")}>lb</button></div>
        <label><span>Current weight</span><input type="number" inputMode="decimal" step="0.1" value={weight} onChange={event => setWeight(event.target.value)} /><small>{weightUnit}</small></label>
      </div>
    </section>

    <section className="goals-section">
      <div className="goals-section-title"><strong>Height and units</strong><span>Choose the system you normally use</span></div>
      <div className="goals-unit-toggle wide"><button type="button" className={heightUnit === "cm" ? "active" : ""} onClick={() => changeHeightUnit("cm")}>Metric</button><button type="button" className={heightUnit === "imperial" ? "active" : ""} onClick={() => changeHeightUnit("imperial")}>Imperial</button></div>
      {heightUnit === "cm"
        ? <label className="goals-field"><span>Height</span><input type="number" inputMode="decimal" value={heightCm} onChange={event => setHeightCm(event.target.value)} /><small>cm</small></label>
        : <div className="goals-height-row"><label><span>Feet</span><input type="number" inputMode="numeric" min="3" max="7" value={feet} onChange={event => setFeet(event.target.value)} /></label><label><span>Inches</span><input type="number" inputMode="numeric" min="0" max="11" value={inches} onChange={event => setInches(event.target.value)} /></label></div>}
    </section>

    <section className="goals-section">
      <div className="goals-section-title"><strong>Primary goal</strong><span>Adjusts the suggested target</span></div>
      <div className="goals-choice-grid">{(Object.keys(goalLabels) as Goal[]).map(value => <button type="button" key={value} className={goal === value ? "active" : ""} onClick={() => setGoal(value)}>{goalLabels[value]}</button>)}</div>
    </section>

    <section className="goals-section">
      <label className="goals-select"><span>Activity level</span><select value={activity} onChange={event => setActivity(event.target.value as Activity)}><option value="">Choose your activity level</option>{(Object.keys(activityLabels) as Activity[]).map(value => <option key={value} value={value}>{activityLabels[value]}</option>)}</select></label>
    </section>

    <section className="goals-section calorie-target-editor">
      <div className="goals-suggestion"><span>Updated estimate</span><strong>{suggested ? `${suggested.toLocaleString()} kcal` : "Complete your details"}</strong><small>Mifflin–St Jeor estimate using your stored age and calculation sex</small>{suggested > 0 && <button type="button" onClick={() => setCalorieGoal(String(suggested))}>Use suggested target</button>}</div>
      <label className="goals-field"><span>Your daily calorie goal</span><input type="number" inputMode="numeric" min="1200" max="6000" step="10" value={calorieGoal} onChange={event => setCalorieGoal(event.target.value)} /><small>kcal</small></label>
      <p className="goals-safety">This estimate is for general planning and is not medical advice. You can keep your own target instead of the suggestion.</p>
    </section>

    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="primary full" type="button" disabled={saving} onClick={save}>{saving ? "Saving changes…" : "Save goals and targets"}</button>
  </div>;
}

export function MacroTargetsEditor({
  profile,
  calorieGoal,
  currentTargets,
  onBack,
  onSave,
}: {
  profile: MealRouteProfile;
  calorieGoal: number;
  currentTargets: MacroTargets;
  onBack: () => void;
  onSave: (values: ProfileMacroUpdate) => Promise<string>;
}) {
  const suggested = useMemo(
    () => suggestedMacroTargets(calorieGoal, profile.primary_goal),
    [calorieGoal, profile.primary_goal],
  );
  const [protein, setProtein] = useState(String(currentTargets.protein));
  const [carbs, setCarbs] = useState(String(currentTargets.carbs));
  const [fat, setFat] = useState(String(currentTargets.fat));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const targets = useMemo<MacroTargets>(() => {
    const values = [protein, carbs, fat].map(value => Number(value));
    return {
      protein: Number.isFinite(values[0]) ? values[0] : 0,
      carbs: Number.isFinite(values[1]) ? values[1] : 0,
      fat: Number.isFinite(values[2]) ? values[2] : 0,
    };
  }, [protein, carbs, fat]);
  const caloriesFromMacros = macroCalories(targets);
  const percentages = macroPercentages(targets);
  const calorieDifference = caloriesFromMacros - calorieGoal;
  const outsideGeneralRange = percentages.protein < 10
    || percentages.protein > 35
    || percentages.carbs < 45
    || percentages.carbs > 65
    || percentages.fat < 20
    || percentages.fat > 35;

  const validationError = useMemo(() => {
    if (!(targets.protein >= 20 && targets.protein <= 500)) return "Enter a protein target between 20 and 500 g.";
    if (!(targets.carbs >= 20 && targets.carbs <= 800)) return "Enter a carbohydrate target between 20 and 800 g.";
    if (!(targets.fat >= 10 && targets.fat <= 300)) return "Enter a fat target between 10 and 300 g.";
    return "";
  }, [targets]);

  function useSuggestion() {
    setProtein(String(suggested.protein));
    setCarbs(String(suggested.carbs));
    setFat(String(suggested.fat));
    setError("");
  }

  async function save() {
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    const usesCustomTargets = targets.protein !== suggested.protein
      || targets.carbs !== suggested.carbs
      || targets.fat !== suggested.fat;
    const saveError = await onSave({
      protein_goal_g: Math.round(targets.protein * 10) / 10,
      carbs_goal_g: Math.round(targets.carbs * 10) / 10,
      fat_goal_g: Math.round(targets.fat * 10) / 10,
      macro_targets_custom: usesCustomTargets,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onBack();
  }

  return <div className="goals-editor macro-targets-editor">
    <button className="goals-back" type="button" onClick={onBack}>‹ Profile</button>
    <p className="eyebrow">MACRO TARGETS</p>
    <h2>Set your daily macros</h2>
    <p className="modal-sub">MealRoute converts your {calorieGoal.toLocaleString()} kcal target into a general starting estimate. You can adjust each value.</p>

    <section className="goals-section macro-suggested-section">
      <div className="goals-section-title"><strong>Suggested starting point</strong><span>Based on your calorie target and {profileGoalLabel(profile.primary_goal).toLowerCase()} goal</span></div>
      <div className="macro-suggested-grid"><div><span>Protein</span><strong>{suggested.protein}g</strong></div><div><span>Carbs</span><strong>{suggested.carbs}g</strong></div><div><span>Fat</span><strong>{suggested.fat}g</strong></div></div>
      <button className="macro-use-suggestion" type="button" onClick={useSuggestion}>Use suggested targets</button>
    </section>

    <section className="goals-section macro-input-grid">
      <label><span>Protein</span><input type="number" inputMode="decimal" min="20" max="500" step="1" value={protein} onChange={event => setProtein(event.target.value)} /><small>g</small></label>
      <label><span>Carbohydrates</span><input type="number" inputMode="decimal" min="20" max="800" step="1" value={carbs} onChange={event => setCarbs(event.target.value)} /><small>g</small></label>
      <label><span>Fat</span><input type="number" inputMode="decimal" min="10" max="300" step="1" value={fat} onChange={event => setFat(event.target.value)} /><small>g</small></label>
    </section>

    <section className="macro-balance-card">
      <div><span>Calories represented by macros</span><strong>{caloriesFromMacros.toLocaleString()} kcal</strong></div>
      <small className={Math.abs(calorieDifference) <= 25 ? "balanced" : ""}>{calorieDifference === 0 ? "Matches your calorie goal" : `${Math.abs(calorieDifference).toLocaleString()} kcal ${calorieDifference > 0 ? "above" : "below"} your goal`}</small>
      <div className="macro-percent-row"><span>Protein {percentages.protein}%</span><span>Carbs {percentages.carbs}%</span><span>Fat {percentages.fat}%</span></div>
    </section>

    {outsideGeneralRange && <div className="connection-notice"><b>Custom distribution</b><span>One or more targets fall outside the general adult AMDR ranges. MealRoute will save your choice, but consider checking it with a qualified health professional.</span></div>}
    <p className="goals-safety">General adult reference ranges: protein 10–35%, carbohydrates 45–65%, and fat 20–35% of calories. Carbohydrate and protein use 4 kcal/g; fat uses 9 kcal/g. <a href="https://nap.nationalacademies.org/skim.php?chap=936-967&record_id=10490" target="_blank" rel="noreferrer">National Academies reference</a>.</p>

    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="primary full" type="button" disabled={saving} onClick={save}>{saving ? "Saving targets…" : "Save macro targets"}</button>
  </div>;
}
export const dietTypeLabels: Record<string, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  halal: "Halal",
  keto: "Keto",
  low_carb: "Low-carb",
};

export const allergyLabels: Record<string, string> = {
  dairy: "Dairy",
  eggs: "Eggs",
  fish: "Fish",
  shellfish: "Shellfish",
  peanuts: "Peanuts",
  tree_nuts: "Tree nuts",
  gluten: "Gluten / wheat",
  soy: "Soy",
  sesame: "Sesame",
};

export function DietaryPreferencesEditor({
  profile,
  onBack,
  onSave,
}: {
  profile: MealRouteProfile;
  onBack: () => void;
  onSave: (values: ProfileDietaryUpdate) => Promise<string>;
}) {
  const [dietType, setDietType] = useState<string>(profile.diet_type || "");
  const [allergies, setAllergies] = useState<string[]>(profile.allergies || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleAllergy(value: string) {
    setAllergies(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  }

  async function save() {
    setSaving(true);
    setError("");
    const saveError = await onSave({
      diet_type: (dietType || null) as MealRouteProfile["diet_type"],
      allergies,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onBack();
  }

  return <div className="goals-editor dietary-editor">
    <button className="goals-back" type="button" onClick={onBack}>‹ Profile</button>
    <p className="eyebrow">DIETARY PREFERENCES</p>
    <h2>Diet and allergies</h2>
    <p className="modal-sub">MealRoute uses these to keep your AI meal plans compatible with your diet and to skip palette foods you avoid.</p>

    <section className="goals-section">
      <div className="goals-section-title"><strong>Diet type</strong><span>Applies to future generated plans</span></div>
      <div className="goals-choice-grid">
        <button type="button" className={dietType === "" ? "active" : ""} onClick={() => setDietType("")}>No restriction</button>
        {Object.entries(dietTypeLabels).map(([value, label]) => <button type="button" key={value} className={dietType === value ? "active" : ""} onClick={() => setDietType(value)}>{label}</button>)}
      </div>
    </section>

    <section className="goals-section">
      <div className="goals-section-title"><strong>Allergies and intolerances</strong><span>Tap to select · tap again to remove</span></div>
      <div className="allergy-chips">
        {Object.entries(allergyLabels).map(([value, label]) => <button type="button" key={value} className={allergies.includes(value) ? "active" : ""} onClick={() => toggleAllergy(value)}>{label}</button>)}
      </div>
    </section>

    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="primary full" type="button" disabled={saving} onClick={save}>{saving ? "Saving preferences…" : "Save dietary preferences"}</button>
  </div>;
}

export function NotificationsEditor({
  profile,
  onBack,
  onSave,
}: {
  profile: MealRouteProfile;
  onBack: () => void;
  onSave: (values: ProfileNotificationsUpdate) => Promise<string>;
}) {
  const [prefs, setPrefs] = useState({
    meals: Boolean(profile.notification_prefs?.meals),
    water: Boolean(profile.notification_prefs?.water),
    weekly: Boolean(profile.notification_prefs?.weekly),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const rows: { key: "meals" | "water" | "weekly"; title: string; description: string }[] = [
    { key: "meals", title: "Meal logging reminders", description: "A nudge on your Today dashboard when you haven't logged any meals by midday" },
    { key: "water", title: "Hydration reminders", description: "A nudge on your Today dashboard if you're behind on water after midday" },
    { key: "weekly", title: "Weekly summary reminder", description: "Highlights your weekly nutrition summary when a new one is ready" },
  ];

  async function save() {
    setSaving(true);
    setError("");
    const saveError = await onSave({ notification_prefs: prefs });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onBack();
  }

  return <div className="goals-editor notifications-editor">
    <button className="goals-back" type="button" onClick={onBack}>‹ Profile</button>
    <p className="eyebrow">NOTIFICATIONS</p>
    <h2>Reminders</h2>
    <p className="modal-sub">Choose which in-app reminders MealRoute shows you. Reminders appear on your Today dashboard.</p>

    <section className="goals-section">
      <div className="notification-toggles">
        {rows.map(row => <button type="button" key={row.key} className={`toggle-row ${prefs[row.key] ? "on" : ""}`} onClick={() => setPrefs(current => ({ ...current, [row.key]: !current[row.key] }))}>
          <span><strong>{row.title}</strong><small>{row.description}</small></span>
          <i className="toggle-switch"><b /></i>
        </button>)}
      </div>
    </section>

    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="primary full" type="button" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save notification settings"}</button>
  </div>;
}
