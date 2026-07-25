import type { NutriPathProfile } from "./profile";

export type Goal = NonNullable<NutriPathProfile["primary_goal"]>;
export type Activity = NonNullable<NutriPathProfile["activity_level"]>;
export type CalculationSex = NonNullable<NutriPathProfile["calculation_sex"]>;

export const activityFactors: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

export const activityLabels: Record<Activity, string> = {
  sedentary: "Sedentary",
  light: "Lightly Active",
  moderate: "Moderately Active",
  very: "Very Active",
  extra: "Extra Active",
};

export const goalLabels: Record<Goal, string> = {
  lose_weight: "Lose Weight",
  build_muscle: "Build Muscle",
  eat_healthier: "Eat Healthier",
  maintain_weight: "Maintain Weight",
};

export function suggestedCalories(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: CalculationSex,
  activity: Activity,
  goal: Goal,
) {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  const maintenance = bmr * activityFactors[activity];
  const adjustment = goal === "lose_weight" ? -500 : goal === "build_muscle" ? 250 : 0;
  const protectedEstimate = Math.max(bmr, maintenance + adjustment, 1200);
  return Math.min(6000, Math.round(protectedEstimate / 10) * 10);
}

export function cmToImperial(cm: number | null) {
  if (!cm) return { feet: "", inches: "" };
  const wholeInches = Math.round(cm / 2.54);
  return {
    feet: String(Math.floor(wholeInches / 12)),
    inches: String(wholeInches % 12),
  };
}
