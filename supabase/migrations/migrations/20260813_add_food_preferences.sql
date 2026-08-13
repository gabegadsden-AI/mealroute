-- Food preferences / palette for AI meal plan generation
create table if not exists public.food_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  fdc_id integer,
  calories_per_100g numeric(8,2) not null default 0,
  protein_per_100g numeric(8,2) not null default 0,
  carbs_per_100g numeric(8,2) not null default 0,
  fat_per_100g numeric(8,2) not null default 0,
  fibre_per_100g numeric(8,2) not null default 0,
  category text not null default 'Other',
  preferred_slots text[] not null default '{breakfast,lunch,dinner,snack}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, food_name)
);

comment on table public.food_preferences is
  'Foods a user enjoys, used as the palette for AI-generated meal plans.';

create index if not exists food_preferences_user_idx
  on public.food_preferences (user_id);

alter table public.food_preferences enable row level security;

drop policy if exists "Users can read their own food preferences" on public.food_preferences;
create policy "Users can read their own food preferences"
  on public.food_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own food preferences" on public.food_preferences;
create policy "Users can create their own food preferences"
  on public.food_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own food preferences" on public.food_preferences;
create policy "Users can update their own food preferences"
  on public.food_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own food preferences" on public.food_preferences;
create policy "Users can delete their own food preferences"
  on public.food_preferences for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.food_preferences to authenticated;

create or replace function public.set_food_preferences_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_food_preferences_updated_at on public.food_preferences;
create trigger set_food_preferences_updated_at
before update on public.food_preferences
for each row execute function public.set_food_preferences_updated_at();
