import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.info("[analytics] PostHog key not set — analytics disabled");
    }
    return;
  }

  posthog.init(key, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    persistence: "localStorage+cookie",
    disable_session_recording: true,
  });

  initialized = true;
}

export function identifyUser(userId: string, props?: Record<string, string | number | boolean>) {
  if (!initialized) return;
  posthog.identify(userId, props);
}

export function resetUser() {
  if (!initialized) return;
  posthog.reset();
}

export function trackScreenView(screen: string) {
  if (!initialized) return;
  posthog.capture("screen_view", { screen });
}

export function trackEvent(event: string, props?: Record<string, string | number | boolean | null>) {
  if (!initialized) return;
  posthog.capture(event, props);
}
