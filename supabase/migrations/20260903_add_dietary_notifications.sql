-- Dietary preferences + notification preferences on profiles
alter table public.profiles
  add column if not exists diet_type text;

alter table public.profiles
  add column if not exists allergies text[] not null default '{}';

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

-- Keep values sane if edited directly
alter table public.profiles
  add constraint profiles_diet_type_check
  check (diet_type is null or diet_type in ('vegetarian','vegan','pescatarian','halal','keto','low_carb'))
  not valid;
