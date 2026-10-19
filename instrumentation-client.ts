// Browser Sentry registration (Next.js client instrumentation hook).
// No-ops when NEXT_PUBLIC_SENTRY_DSN is unset, so nothing loads on the
// production site until Gabriel adds the DSN in Vercel.
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
    tracesSampleRate: 0.1,
  });
}
