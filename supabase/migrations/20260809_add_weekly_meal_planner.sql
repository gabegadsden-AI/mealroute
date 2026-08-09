alter table public.meal_entries
  add column if not exists meal_slot text
    check (meal_slot is null or meal_slot in ('breakfast', 'lunch', 'dinner', 'snack'));

comment on column public.meal_entries.meal_slot is
  'Optional weekly-planner slot for a planned meal. The planned date uses meal_date.';

create index if not exists meal_entries_user_plan_date_idx
  on public.meal_entries (user_id, entry_kind, meal_date);

alter table public.meal_entries enable row level security;

drop policy if exists "Weekly planner users can read own meals" on public.meal_entries;
create policy "Weekly planner users can read own meals"
  on public.meal_entries for select
  using (auth.uid() = user_id);

drop policy if exists "Weekly planner users can create own meals" on public.meal_entries;
create policy "Weekly planner users can create own meals"
  on public.meal_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Weekly planner users can update own meals" on public.meal_entries;
create policy "Weekly planner users can update own meals"
  on public.meal_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Weekly planner users can delete own meals" on public.meal_entries;
create policy "Weekly planner users can delete own meals"
  on public.meal_entries for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.meal_entries to authenticated;
