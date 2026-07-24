export type NutriPathProfile = {
  user_id: string;
  name: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  weight_unit: "kg" | "lb";
  height_unit: "cm" | "imperial";
  primary_goal: "lose_weight" | "build_muscle" | "eat_healthier" | "maintain_weight" | null;
  age: number | null;
  calculation_sex: "female" | "male" | null;
  activity_level: "sedentary" | "light" | "moderate" | "very" | "extra" | null;
  calorie_goal: number | null;
  suggested_calorie_goal: number | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  local_import_status: "pending" | "imported" | "skipped";
  created_at: string;
};

export const profileSelect = "user_id,name,weight_kg,height_cm,weight_unit,height_unit,primary_goal,age,calculation_sex,activity_level,calorie_goal,suggested_calorie_goal,onboarding_step,onboarding_completed,local_import_status,created_at" as const;
