"use client";
import "../auth.css";

import { useMemo, useState } from "react";
import {
  cmToImperial,
  goalLabels,
  suggestedCalories,
  type Activity,
  type CalculationSex,
  type Goal,
} from "../../lib/calorie-goal";
import type { NutriPathProfile } from "../../lib/profile";
import { createClient } from "../../lib/supabase/client";

const totalSteps = 8;

export default function OnboardingWizard({ userId, initialProfile }: { userId: string; initialProfile: NutriPathProfile | null }) {
  const imperialHeight = cmToImperial(initialProfile?.height_cm || null);
  const [step, setStep] = useState(Math.min(7, Math.max(0, initialProfile?.onboarding_step || 0)));
  const [name, setName] = useState(initialProfile?.name || "");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">(initialProfile?.weight_unit || "kg");
  const [weight, setWeight] = useState(initialProfile?.weight_kg
    ? String(initialProfile.weight_unit === "lb" ? Math.round(initialProfile.weight_kg * 2.20462 * 10) / 10 : initialProfile.weight_kg)
    : "");
  const [heightUnit, setHeightUnit] = useState<"cm" | "imperial">(initialProfile?.height_unit || "cm");
  const [heightCm, setHeightCm] = useState(initialProfile?.height_cm ? String(initialProfile.height_cm) : "");
  const [feet, setFeet] = useState(imperialHeight.feet);
  const [inches, setInches] = useState(imperialHeight.inches);
  const [goal, setGoal] = useState<Goal | "">(initialProfile?.primary_goal || "");
  const [age, setAge] = useState(initialProfile?.age ? String(initialProfile.age) : "");
  const [sex, setSex] = useState<CalculationSex | "">(initialProfile?.calculation_sex || "");
  const [activity, setActivity] = useState<Activity | "">(initialProfile?.activity_level || "");
  const [calorieGoal, setCalorieGoal] = useState(initialProfile?.calorie_goal ? String(initialProfile.calorie_goal) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const normalizedWeight = useMemo(() => {
    const value = Number(weight);
    return weightUnit === "lb" ? value / 2.20462 : value;
  }, [weight, weightUnit]);

  const normalizedHeight = useMemo(() => {
    if (heightUnit === "cm") return Number(heightCm);
    return (Number(feet) * 12 + Number(inches)) * 2.54;
  }, [heightCm, heightUnit, feet, inches]);

  const suggested = useMemo(() => {
    if (!(normalizedWeight > 0) || !(normalizedHeight > 0) || !(Number(age) >= 18) || !sex || !activity || !goal) return 0;
    return suggestedCalories(normalizedWeight, normalizedHeight, Number(age), sex, activity, goal);
  }, [normalizedWeight, normalizedHeight, age, sex, activity, goal]);

  function validCurrentStep() {
    if (step === 0) return name.trim().length >= 2;
    if (step === 1) return normalizedWeight >= 30 && normalizedWeight <= 350;
    if (step === 2) return normalizedHeight >= 120 && normalizedHeight <= 230;
    if (step === 3) return Boolean(goal);
    if (step === 4) return Number(age) >= 18 && Number(age) <= 100;
    if (step === 5) return Boolean(sex);
    if (step === 6) return Boolean(activity);
    return Number(calorieGoal || suggested) >= 1200 && Number(calorieGoal || suggested) <= 6000;
  }

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

  function profileValues(nextStep: number, completed = false) {
    return {
      user_id: userId,
      name: name.trim() || null,
      weight_kg: normalizedWeight > 0 ? Math.round(normalizedWeight * 10) / 10 : null,
      height_cm: normalizedHeight > 0 ? Math.round(normalizedHeight * 10) / 10 : null,
      weight_unit: weightUnit,
      height_unit: heightUnit,
      primary_goal: goal || null,
      age: Number(age) || null,
      calculation_sex: sex || null,
      activity_level: activity || null,
      suggested_calorie_goal: suggested || null,
      calorie_goal: Number(calorieGoal || suggested) || null,
      onboarding_step: nextStep,
      onboarding_completed: completed,
    };
  }

  async function continueOnboarding() {
    if (!validCurrentStep()) {
      setError(step === 7
        ? "Enter a daily calorie target between 1,200 and 6,000 kcal."
        : "Please complete this question before continuing.");
      return;
    }

    setSaving(true);
    setError("");
    const finishing = step === totalSteps - 1;
    const nextStep = finishing ? totalSteps : step + 1;
    const supabase = createClient();
    const { error: saveError } = await supabase
      .from("profiles")
      .upsert(profileValues(nextStep, finishing), { onConflict: "user_id" });

    if (saveError) {
      setError("Your progress could not be saved. Please check your connection and try again.");
      setSaving(false);
      return;
    }

    if (finishing) {
      window.location.assign("/");
      return;
    }

    if (step === 6 && !calorieGoal && suggested) setCalorieGoal(String(suggested));
    setStep(nextStep);
    setSaving(false);
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <div className="auth-brand"><span>NP</span><div><strong>NutriPath</strong><small>Set up your nutrition path</small></div></div>
        <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${totalSteps}`}>
          <i style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
        </div>
        <p className="eyebrow">STEP {step + 1} OF {totalSteps}</p>

        {step === 0 && <div className="onboarding-question"><h1>What’s your name?</h1><p>We’ll use this to personalise your dashboard.</p><label><span>Name</span><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Enter your name" /></label></div>}

        {step === 1 && <div className="onboarding-question"><h1>What’s your current weight?</h1><p>You can change the unit at any time.</p><div className="unit-toggle"><button className={weightUnit === "kg" ? "active" : ""} onClick={() => changeWeightUnit("kg")}>kg</button><button className={weightUnit === "lb" ? "active" : ""} onClick={() => changeWeightUnit("lb")}>lb</button></div><label><span>Weight ({weightUnit})</span><input autoFocus type="number" inputMode="decimal" min="1" step="0.1" value={weight} onChange={event => setWeight(event.target.value)} /></label></div>}

        {step === 2 && <div className="onboarding-question"><h1>How tall are you?</h1><p>Choose the measurement system you normally use.</p><div className="unit-toggle"><button className={heightUnit === "cm" ? "active" : ""} onClick={() => changeHeightUnit("cm")}>Metric</button><button className={heightUnit === "imperial" ? "active" : ""} onClick={() => changeHeightUnit("imperial")}>Imperial</button></div>{heightUnit === "cm" ? <label><span>Height (cm)</span><input autoFocus type="number" inputMode="decimal" min="120" max="230" value={heightCm} onChange={event => setHeightCm(event.target.value)} /></label> : <div className="height-fields"><label><span>Feet</span><input autoFocus type="number" inputMode="numeric" min="3" max="7" value={feet} onChange={event => setFeet(event.target.value)} /></label><label><span>Inches</span><input type="number" inputMode="numeric" min="0" max="11" value={inches} onChange={event => setInches(event.target.value)} /></label></div>}</div>}

        {step === 3 && <div className="onboarding-question"><h1>What’s your primary goal?</h1><p>This adjusts your suggested daily calorie target.</p><div className="choice-list">{(Object.keys(goalLabels) as Goal[]).map(value => <button key={value} className={goal === value ? "active" : ""} onClick={() => setGoal(value)}><strong>{goalLabels[value]}</strong></button>)}</div></div>}

        {step === 4 && <div className="onboarding-question"><h1>How old are you?</h1><p>NutriPath currently calculates targets for adults aged 18 and older.</p><label><span>Age</span><input autoFocus type="number" inputMode="numeric" min="18" max="100" value={age} onChange={event => setAge(event.target.value)} /></label></div>}

        {step === 5 && <div className="onboarding-question"><h1>Which sex should the calorie formula use?</h1><p>The Mifflin–St Jeor formula uses this value when estimating resting energy needs.</p><div className="choice-list two"><button className={sex === "female" ? "active" : ""} onClick={() => setSex("female")}><strong>Female</strong></button><button className={sex === "male" ? "active" : ""} onClick={() => setSex("male")}><strong>Male</strong></button></div></div>}

        {step === 6 && <div className="onboarding-question"><h1>What’s your activity level?</h1><p>Choose the option that best describes a typical week.</p><div className="choice-list activity"><button className={activity === "sedentary" ? "active" : ""} onClick={() => setActivity("sedentary")}><strong>Sedentary</strong><span>Mostly seated, little planned exercise</span></button><button className={activity === "light" ? "active" : ""} onClick={() => setActivity("light")}><strong>Lightly Active</strong><span>Light exercise 1–3 days per week</span></button><button className={activity === "moderate" ? "active" : ""} onClick={() => setActivity("moderate")}><strong>Moderately Active</strong><span>Moderate exercise 3–5 days per week</span></button><button className={activity === "very" ? "active" : ""} onClick={() => setActivity("very")}><strong>Very Active</strong><span>Hard exercise 6–7 days per week</span></button><button className={activity === "extra" ? "active" : ""} onClick={() => setActivity("extra")}><strong>Extra Active</strong><span>Very hard training or a physical job</span></button></div></div>}

        {step === 7 && <div className="onboarding-question"><h1>Set your daily calorie goal</h1><p>NutriPath calculated a starting estimate from your confirmed details.</p><div className="calorie-suggestion"><span>Suggested target</span><strong>{suggested.toLocaleString()} kcal</strong><small>Mifflin–St Jeor resting-energy estimate, activity factor and goal adjustment</small></div><label><span>Your daily goal (kcal)</span><input autoFocus type="number" inputMode="numeric" min="1200" max="6000" step="10" value={calorieGoal || suggested || ""} onChange={event => setCalorieGoal(event.target.value)} /></label><div className="safety-note"><strong>This is an estimate.</strong><span>It is for general planning, not medical advice. If you are pregnant, breastfeeding, have a medical condition or have an eating-disorder history, ask a qualified health professional before using a calorie deficit.</span></div></div>}

        {error && <div className="auth-error" role="alert">{error}</div>}
        <div className="onboarding-actions">
          {step > 0 && <button className="secondary" disabled={saving} onClick={() => setStep(current => current - 1)}>Back</button>}
          <button className="primary" disabled={saving || !validCurrentStep()} onClick={continueOnboarding}>{saving ? "Saving…" : step === totalSteps - 1 ? "Finish setup" : "Continue"}</button>
        </div>
        <p className="onboarding-save-note">Your progress is saved after every step.</p>
      </section>
    </main>
  );
}
