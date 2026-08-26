-- Ensure the (user_id, client_key) unique constraint exists so that
-- syncCloudMeals upserts with onConflict: "user_id,client_key" work correctly.
-- Without this constraint, upserts silently insert duplicates instead of
-- updating existing rows, and the stale-key deletion can remove rows that
-- should have been updated.

-- Drop any existing constraint with the same name (idempotent)
alter table public.meal_entries
  drop constraint if exists meal_entries_user_client_key_unique;

-- Add the unique constraint
alter table public.meal_entries
  add constraint meal_entries_user_client_key_unique
  unique (user_id, client_key);
