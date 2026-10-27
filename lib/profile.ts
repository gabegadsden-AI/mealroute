export type MealRouteProfile = {
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
  protein_goal_g: number | null;
  carbs_goal_g: number | null;
  fat_goal_g: number | null;
  macro_targets_custom: boolean;
  diet_type: "vegetarian" | "vegan" | "pescatarian" | "halal" | "keto" | "low_carb" | null;
  allergies: string[];
  notification_prefs: { meals?: boolean; water?: boolean; weekly?: boolean };
  water_goal_ml: number;
  onboarding_step: number;
  onboarding_completed: boolean;
  local_import_status: "pending" | "imported" | "skipped";
  // Pro trial + Stripe subscription state
  trial_ends_at: string | null;
  subscription_status: string | null;
  subscription_interval: string | null;
  current_period_end: string | null;
  is_grandfathered: boolean | null;
  created_at: string;
};

export const profileSelect = "user_id,name,weight_kg,height_cm,weight_unit,height_unit,primary_goal,age,calculation_sex,activity_level,calorie_goal,suggested_calorie_goal,protein_goal_g,carbs_goal_g,fat_goal_g,macro_targets_custom,diet_type,allergies,notification_prefs,water_goal_ml,onboarding_step,onboarding_completed,local_import_status,trial_ends_at,subscription_status,subscription_interval,current_period_end,is_grandfathered,created_at" as const;

// Pre-migration fallback: the subscription columns may not exist yet in a
// given environment. Queries that must never break on schema lag use this
// column list and synthesize subscription defaults themselves.
export const legacyProfileSelect = "user_id,name,weight_kg,height_cm,weight_unit,height_unit,primary_goal,age,calculation_sex,activity_level,calorie_goal,suggested_calorie_goal,protein_goal_g,carbs_goal_g,fat_goal_g,macro_targets_custom,diet_type,allergies,notification_prefs,water_goal_ml,onboarding_step,onboarding_completed,local_import_status,created_at" as const;
