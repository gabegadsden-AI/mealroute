alter table public.profiles
  add column if not exists protein_goal_g numeric(6,1)
    check (protein_goal_g is null or protein_goal_g between 0 and 500),
  add column if not exists carbs_goal_g numeric(6,1)
    check (carbs_goal_g is null or carbs_goal_g between 0 and 800),
  add column if not exists fat_goal_g numeric(6,1)
    check (fat_goal_g is null or fat_goal_g between 0 and 300),
  add column if not exists macro_targets_custom boolean not null default false;

comment on column public.profiles.protein_goal_g is
  'Authenticated user daily protein target in grams.';
comment on column public.profiles.carbs_goal_g is
  'Authenticated user daily carbohydrate target in grams.';
comment on column public.profiles.fat_goal_g is
  'Authenticated user daily fat target in grams.';
comment on column public.profiles.macro_targets_custom is
  'True when the user saved manual macro targets instead of the current NutriPath suggestion.';
