# NutriPath Supabase deployment checklist

Complete these steps in order.

## 1. Create the Supabase project

1. Sign in to Supabase.
2. Create a project named `NutriPath`.
3. Save the project’s database password somewhere secure. Do not put it in GitHub or Vercel.

## 2. Create the database tables and security policies

1. In Supabase, open **SQL Editor**.
2. In this update, open:
   `supabase/migrations/202607240001_auth_and_cloud_data.sql`
3. Copy the complete file into a new SQL query.
4. Select **Run**.
5. Confirm the query completes without an error.

## 3. Configure authentication URLs

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to the stable Vercel production address for NutriPath.
3. Add this redirect URL, replacing the example domain:
   `https://YOUR-NUTRIPATH-DOMAIN/auth/callback`
4. Keep email confirmation enabled.

## 4. Copy the two public Supabase values

Open the Supabase **Connect** dialog and copy:

- Project URL
- Publishable key

The publishable key is safe to use in browser code when Row Level Security is enabled. Do not use or copy the service-role key.

## 5. Add Vercel environment variables

In **Vercel → NutriPath → Settings → Environment Variables**, add:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable key |

Keep the existing `OPENAI_API_KEY`, `USDA_API_KEY`, and `OPENAI_MODEL` variables.

Enable the new variables for Production and Preview. Save them, then redeploy the latest commit.

## 6. First account test

1. Open the stable production URL in a private browser window.
2. Confirm the login screen appears.
3. Select **Create an account**.
4. Sign up with an email address and password.
5. Open the verification email.
6. Confirm the link opens NutriPath onboarding.
7. Complete all eight onboarding screens.
8. Confirm the dashboard uses the entered name and calorie goal.

## 7. Data-isolation test

1. Log one test meal with the first account.
2. Log out.
3. Create a second test account with another email address.
4. Confirm the second account cannot see the first account’s meal, plan, History, or saved products.

## 8. Browser-data import test

On the original browser and stable NutriPath domain:

1. Sign in to the account that should own the existing NutriPath data.
2. When prompted, select **Import to my account**.
3. Confirm the saved meals, planned meals, History, and packaged products appear.
4. Refresh the page.
5. Confirm the imported data remains and no duplicate meals were created.

Do not test the first import on a new Vercel preview address. Browser storage belongs to the exact website address where it was created.
