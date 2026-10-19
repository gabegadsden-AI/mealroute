import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import GlobalError from "../app/global-error";

// Sentry error monitoring (Oct 2026): the app ships with Sentry wired in but
// fully inert — no DSN, no telemetry, no crash. When a DSN IS configured in
// Vercel, crashes on the server, the browser, and React render errors are all
// reported. The global crash screen must render branded, reassuring fallback
// UI so testers and users never see a blank white page.

describe("Global crash screen", () => {
  it("renders branded fallback UI with recovery actions instead of a blank page", () => {
    const html = renderToString(
      createElement(GlobalError, { error: new Error("render exploded"), reset: () => {} })
    );
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Your data is safe");
    expect(html).toContain("Try again");
    expect(html).toContain("Reload MealRoute");
    // MealRoute brand green button, dark ink text (a11y: never white-on-green)
    expect(html).toContain("#5db04d");
    expect(html).toContain("#1c2920");
  });

  it("mentions that the crash was logged so users know it is being tracked", () => {
    const html = renderToString(
      createElement(GlobalError, { error: new Error("kaboom"), reset: () => {} })
    );
    expect(html).toContain("logged");
  });
});
