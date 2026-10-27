# MealRoute Supabase deployment checklist

## 1. Create Supabase project

1. Go to https://supabase.com and create a new project.
2. Create a project named `MealRoute`.
3. Note your Project URL and anon key (Project Settings → API).

## 2. Configure Auth

1. Enable Email auth under Authentication → Providers.
2. Set **Site URL** to the stable Vercel production address for MealRoute.
3. Add redirect URLs:
   - `https://YOUR-MEALROUTE-DOMAIN/auth/callback`

## 3. Run migrations

Apply the SQL migrations in `supabase/migrations/` using the Supabase SQL editor or `supabase db push`.

## 4. Environment variables

In **Vercel → MealRoute → Settings → Environment Variables**, add:

- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key
- `USDA_API_KEY` — your USDA FoodData Central API key
- `OPENAI_API_KEY` — your OpenAI API key

### Stripe (Pro subscriptions — $6.99/mo, $49/yr, 7-day no-card trial)

1. Create a Stripe account → create two recurring prices on a "MealRoute Pro" product: **$6.99/month** and **$49/year**. Copy both price IDs (`price_...`).
2. In Vercel env vars add:
  - `STRIPE_SECRET_KEY` — secret key (`sk_live_...` or `sk_test_...`)
  - `STRIPE_PRICE_MONTHLY` — monthly price ID
  - `STRIPE_PRICE_ANNUAL` — annual price ID
  - `STRIPE_WEBHOOK_SECRET` — from the webhook endpoint below (`whsec_...`)
  - `NEXT_PUBLIC_SITE_URL` — `https://mealroute.app` (used for Stripe redirects)
3. Stripe dashboard → Webhooks → Add endpoint: `https://mealroute.app/api/stripe/webhook` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Stripe dashboard → Settings → Billing portal: enable it (default config is fine) so Pro users can cancel from the app.
5. Apply `supabase/migrations/20261027_add_subscriptions.sql` in the Supabase SQL editor.

The app is fully functional without these keys — every Stripe route degrades gracefully (checkout returns a friendly "billing launches shortly" message) and the trial/entitlement logic works standalone.

## 5. Deploy

1. Push to the `main` branch.
2. Vercel auto-deploys.
3. Confirm the link opens MealRoute onboarding.
