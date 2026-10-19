// Server & Edge runtime Sentry registration (Next.js instrumentation hook).
// Fully inert until SENTRY_DSN is set in the environment, so builds and
// deploys work with or without a Sentry account configured.
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
