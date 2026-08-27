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

## 5. Deploy

1. Push to the `main` branch.
2. Vercel auto-deploys.
3. Confirm the link opens MealRoute onboarding.
