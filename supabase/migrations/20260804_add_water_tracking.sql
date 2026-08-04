alter table public.profiles
  add column if not exists water_goal_ml integer not null default 2500
    check (water_goal_ml between 250 and 10000);

comment on column public.profiles.water_goal_ml is
  'Authenticated user daily water target in millilitres. This is user-configured and is not a medical recommendation.';

create table if not exists public.water_daily_totals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  amount_ml integer not null default 0 check (amount_ml between 0 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

comment on table public.water_daily_totals is
  'One exact water total per authenticated user and local calendar date.';

create index if not exists water_daily_totals_user_date_idx
  on public.water_daily_totals (user_id, log_date desc);

alter table public.water_daily_totals enable row level security;

drop policy if exists "Users can read their own water totals" on public.water_daily_totals;
create policy "Users can read their own water totals"
  on public.water_daily_totals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own water totals" on public.water_daily_totals;
create policy "Users can create their own water totals"
  on public.water_daily_totals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own water totals" on public.water_daily_totals;
create policy "Users can update their own water totals"
  on public.water_daily_totals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own water totals" on public.water_daily_totals;
create policy "Users can delete their own water totals"
  on public.water_daily_totals for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.water_daily_totals to authenticated;

create or replace function public.set_water_daily_totals_updated_at()
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

drop trigger if exists set_water_daily_totals_updated_at on public.water_daily_totals;
create trigger set_water_daily_totals_updated_at
before update on public.water_daily_totals
for each row execute function public.set_water_daily_totals_updated_at();
