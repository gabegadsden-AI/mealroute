-- ─────────────────────────────────────────────────────────────────────
-- MealRoute: PASTE-READY COMBINED MIGRATION (2026-10-27)
-- Paste this WHOLE file into the Supabase SQL editor and Run.
-- Safe to run more than once (idempotent where possible).
-- Contains: (1) micronutrient columns on recent_foods (pending since Aug 28)
--           (2) Pro trial + Stripe subscription columns on profiles
-- After running, no deploy is needed — the app picks up real
-- trial/subscription state automatically (schema-lag mode turns off).
-- ─────────────────────────────────────────────────────────────────────

-- (1) Micronutrients on recent_foods
ALTER TABLE public.recent_foods
  ADD COLUMN IF NOT EXISTS micro_vitamin_a numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_c numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_d numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_e numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_k numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_thiamin numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_riboflavin numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_niacin numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_b6 numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_folate numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_vitamin_b12 numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_calcium numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_iron numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_magnesium numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_potassium numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_zinc numeric(10,3),
  ADD COLUMN IF NOT EXISTS micro_sodium numeric(10,3);

-- (2) Pro trial + Stripe subscriptions on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz default (now() + interval '7 day'),
  ADD COLUMN IF NOT EXISTS subscription_status text not null default 'trialing',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_interval text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS is_grandfathered boolean not null default false;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Grandfather every account that existed before launch (beta testers):
-- lifetime Pro.
UPDATE public.profiles
SET is_grandfathered = true
WHERE created_at <= now()
  AND is_grandfathered = false;
