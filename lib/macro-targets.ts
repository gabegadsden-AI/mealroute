import type { MealRouteProfile } from "./profile";

export type MacroTargets = {
  protein: number;
  carbs: number;
  fat: number;
};

type Goal = NonNullable<MealRouteProfile["primary_goal"]>;

const macroRatios: Record<Goal, { protein: number; carbs: number; fat: number }> = {
  lose_weight: { protein: 0.30, carbs: 0.45, fat: 0.25 },
  build_muscle: { protein: 0.25, carbs: 0.50, fat: 0.25 },
  eat_healthier: { protein: 0.20, carbs: 0.50, fat: 0.30 },
  maintain_weight: { protein: 0.20, carbs: 0.50, fat: 0.30 },
};

export function macroCalories(targets: MacroTargets) {
  return Math.round(targets.protein * 4 + targets.carbs * 4 + targets.fat * 9);
}

export function suggestedMacroTargets(
  calorieGoal: number,
  goal: MealRouteProfile["primary_goal"],
): MacroTargets {
  const safeCalories = Math.min(6000, Math.max(1200, Math.round(Number(calorieGoal) || 2000)));
  const ratios = macroRatios[goal || "eat_healthier"];
  const protein = Math.round((safeCalories * ratios.protein) / 4);
  const fat = Math.round((safeCalories * ratios.fat) / 9);
  const carbs = Math.max(0, Math.round((safeCalories - protein * 4 - fat * 9) / 4));
  return { protein, carbs, fat };
}

export function macroPercentages(targets: MacroTargets) {
  const calories = macroCalories(targets);
  if (!calories) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round((targets.protein * 4 / calories) * 100),
    carbs: Math.round((targets.carbs * 4 / calories) * 100),
    fat: Math.round((targets.fat * 9 / calories) * 100),
  };
}
