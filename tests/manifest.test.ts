import { describe, it, expect } from "vitest";
import manifest from "../app/manifest";

// PWA installability (Oct 2026): MealRoute ships as an installable web app so
// testers and promo-driven users can add it to their home screen from the
// browser, launching full-screen with the fork-knife-plate icon. The manifest
// is also the prerequisite for the planned Google Play Trusted Web Activity
// wrapper, which validates against these exact fields.

describe("Web app manifest (PWA installability)", () => {
  const m = manifest();

  it("declares standalone display so installs launch without browser chrome", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
  });

  it("uses the MealRoute brand identity", () => {
    expect(m.short_name).toBe("MealRoute");
    expect(m.name).toContain("MealRoute");
    expect(m.theme_color).toBe("#5db04d"); // brand green
    expect(m.background_color).toBe("#ffffff");
  });

  it("provides the icon set stores and launchers require, including maskable", () => {
    const icons = m.icons ?? [];
    expect(icons.some((i) => i.sizes === "192x192")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512")).toBe(true);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  });
});
