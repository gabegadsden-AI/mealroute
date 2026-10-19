"use client";
// Global crash screen: renders when a React render error escapes every other
// error boundary, and reports the crash to Sentry when the DSN is configured.
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f5f8f6", color: "#1c2920", fontFamily: "system-ui, -apple-system, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", padding: "24px", boxSizing: "border-box" }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ width: 52, height: 52, margin: "0 auto 18px", borderRadius: 16, background: "#5db04d", color: "#1c2920", display: "grid", placeItems: "center", fontSize: 24 }}>🍽️</div>
          <h1 style={{ fontSize: 22, letterSpacing: "-0.03em", margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#5b6b60", margin: "0 0 20px" }}>
            MealRoute hit an unexpected error and the crash has been logged. Your data is safe — try again, or reload the page.
          </p>
          <button onClick={() => reset()} style={{ border: "1px solid #5db04d", background: "#5db04d", color: "#1c2920", borderRadius: 12, padding: "13px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginRight: 8 }}>
            Try again
          </button>
          <button onClick={() => window.location.reload()} style={{ border: "1px solid #dfe6e0", background: "#fff", color: "#1c2920", borderRadius: 12, padding: "13px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Reload MealRoute
          </button>
        </div>
      </body>
    </html>
  );
}
