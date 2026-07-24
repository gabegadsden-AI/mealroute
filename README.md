# NutriPath

NutriPath is a mobile-first calorie tracker and meal-planning app. It supports authenticated user accounts, guided onboarding, cloud-synced meals and plans, photo-based food analysis, confirmed-gram calculations, USDA FoodData Central sources, and package-label nutrition.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Open `supabase/migrations/202607240001_auth_and_cloud_data.sql` from this repository.
4. Copy the complete SQL file into the editor and run it once.
5. Open the Supabase **Connect** dialog and copy:
   - Project URL
   - Publishable key
6. Open **Authentication → URL Configuration**.
7. Set **Site URL** to the stable NutriPath production address.
8. Add these redirect URLs:
   - `https://YOUR-NUTRIPATH-DOMAIN/auth/callback`
   - `http://localhost:3000/auth/callback` for local development

Email and password authentication is enabled by default on hosted Supabase projects. Keep email confirmation enabled. Supabase’s default mail service is intended for early testing and is rate-limited; configure custom SMTP before inviting production users.

The SQL migration creates:

- private user profiles and onboarding progress;
- dated and planned meal records;
- daily nutrition totals;
- saved packaged products;
- indexes and Row Level Security policies;
- a profile trigger for new authenticated users.

Every user-data policy checks that `auth.uid()` matches `user_id`. The app also filters client requests by the signed-in user ID as defense in depth.

## Vercel environment variables

Open **Vercel → NutriPath → Settings → Environment Variables** and add:

```text
NEXT_PUBLIC_SUPABASE_URL=your Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your Supabase publishable key
OPENAI_API_KEY=your OpenAI API key
USDA_API_KEY=your USDA FoodData Central API key
OPENAI_MODEL=gpt-5.6
```

Enable the variables for Production and Preview, then redeploy.

NutriPath does not need a Supabase service-role key. Never expose a service-role key in browser code or in an environment variable beginning with `NEXT_PUBLIC_`.

## Authentication flow

- New users sign up with email and password.
- Supabase sends an email-verification link.
- Verified users complete eight onboarding screens.
- The app saves onboarding progress after each completed screen.
- The dashboard and food-analysis endpoint require an authenticated session.
- Login sessions persist through secure auth cookies refreshed by Next.js Proxy.
- Forgot-password emails return users to the protected password-update page.
- Users can log out from the profile panel.

## Calorie estimate

The onboarding suggestion uses the Mifflin–St Jeor resting-energy formula, an activity multiplier, and a goal adjustment:

- Lose weight: 500 kcal below estimated maintenance, without suggesting below estimated resting energy.
- Build muscle: 250 kcal above estimated maintenance.
- Eat healthier or maintain weight: estimated maintenance.

The target is labelled as an estimate. Onboarding is limited to adults, accepts targets from 1,200 to 6,000 kcal, and shows a safety notice for people who should seek individual professional guidance.

## Existing browser data

After the first authenticated login, NutriPath checks for meals, plans, History, and packaged products saved by the earlier browser-only version. If data exists, the user can import it once. Database uniqueness constraints prevent duplicate imported records. The browser copy is retained as a local cache.

## Local development

Copy `.env.example` to `.env.local`, add development values, and run:

```bash
npm install
npm run dev
```

Never commit real API keys.
