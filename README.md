# NutriPath

NutriPath is a mobile-first calorie tracker and meal-planning prototype with real server-side food-photo analysis through the OpenAI Responses API.

## Deploy to Vercel

1. Import this repository into Vercel as a Next.js project.
2. Open **Project Settings → Environment Variables**.
3. Add `OPENAI_API_KEY` as a secret for Production, Preview, and Development.
4. Optionally add `OPENAI_MODEL`; the default is `gpt-5.6`.
5. Redeploy after adding or changing an environment variable.

Never put the API key in source code, browser storage, or a client-side environment variable. Do not prefix it with `NEXT_PUBLIC_`.

## Local development

Copy `.env.example` to `.env.local`, add a development API key, then run:

```bash
npm install
npm run dev
```

The food-analysis endpoint validates image input, keeps the key server-side, requests structured nutrition estimates, and returns at most two image-specific clarification questions. Nutrition values remain estimates and should be verified by users.
