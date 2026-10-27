-- ─────────────────────────────────────────────────────────────────────
-- Pro trial + Stripe subscription tracking (2026-10-27)
-- Model: 7-day no-card Pro trial from signup → auto-drop to Free tier.
-- Pricing: $6.99/mo or $49/yr. Beta testers grandfathered to lifetime Pro.
-- ─────────────────────────────────────────────────────────────────────

-- Subscription columns on profiles.
-- trial_ends_at defaults to signup + 7 days for every NEW profile row.
alter table public.profiles
  add column if not exists trial_ends_at timestamptz default (now() + interval '7 day'),
  add column if not exists subscription_status text not null default 'trialing',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_interval text,      -- 'monthly' | 'annual'
  add column if not exists current_period_end timestamptz,
  add column if not exists is_grandfathered boolean not null default false;

create index if not exists idx_profiles_stripe_customer
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Grandfather every account that existed before launch (the beta testers):
-- lifetime Pro, no trial countdown, no card required.
update public.profiles
set is_grandfathered = true
where created_at <= now()
  and is_grandfathered = false;

-- Enable row-level ownership rules if not already present (defensive).
alter table public.profiles enable row level security;
