import { describe, it, expect } from "vitest";
import {
  computeEntitlement,
  isProUser,
  TRIAL_DAYS,
  FREE_PLAN_LIMIT_DAYS,
  type SubscriptionFields,
} from "../lib/entitlements";

const now = new Date("2026-10-27T12:00:00Z");
const daysFromNow = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

const trialing = (days: number): SubscriptionFields => ({
  trial_ends_at: daysFromNow(days),
  subscription_status: "trialing",
  current_period_end: null,
  is_grandfathered: false,
});

describe("computeEntitlement — grandfathered beta testers", () => {
  it("grandfathered users keep Pro forever regardless of anything else", () => {
    const e = computeEntitlement({ trial_ends_at: null, subscription_status: "free", current_period_end: null, is_grandfathered: true }, now);
    expect(e.isPro).toBe(true);
    expect(e.state).toBe("grandfathered");
    expect(e.maxPlanDays).toBe(7);
  });
});

describe("computeEntitlement — 7-day no-card trial", () => {
  it("fresh signup: full trial, Pro features unlocked", () => {
    const e = computeEntitlement(trialing(TRIAL_DAYS), now);
    expect(e.isPro).toBe(true);
    expect(e.state).toBe("trialing");
    expect(e.trialDaysLeft).toBe(TRIAL_DAYS);
    expect(e.trialEndsSoon).toBe(false);
    expect(e.maxPlanDays).toBe(7);
  });

  it("day 6: reminder flag fires within 24h of expiry", () => {
    const e = computeEntitlement(trialing(0.5), now);
    expect(e.isPro).toBe(true);
    expect(e.trialEndsSoon).toBe(true);
  });

  it("day 8: auto-drops to Free with no cron — timestamp does the work", () => {
    const e = computeEntitlement(trialing(-1), now);
    expect(e.isPro).toBe(false);
    expect(e.state).toBe("free");
    expect(e.maxPlanDays).toBe(FREE_PLAN_LIMIT_DAYS);
  });

  it("missing trial timestamp (pre-launch profile) reads as Free, not crash", () => {
    const e = computeEntitlement({ trial_ends_at: null, subscription_status: "free", current_period_end: null, is_grandfathered: false }, now);
    expect(e.isPro).toBe(false);
    expect(e.state).toBe("free");
  });
});

describe("computeEntitlement — Stripe subscription states", () => {
  it("active subscription with a future period end is Pro", () => {
    const e = computeEntitlement({ trial_ends_at: daysFromNow(-30), subscription_status: "active", current_period_end: daysFromNow(20), is_grandfathered: false }, now);
    expect(e.isPro).toBe(true);
    expect(e.state).toBe("pro");
  });

  it("active subscription whose period lapsed reads as Free (webhook catch-up)", () => {
    const e = computeEntitlement({ trial_ends_at: daysFromNow(-30), subscription_status: "active", current_period_end: daysFromNow(-1), is_grandfathered: false }, now);
    expect(e.isPro).toBe(false);
  });

  it("canceled subscription drops to Free immediately", () => {
    const e = computeEntitlement({ trial_ends_at: daysFromNow(-30), subscription_status: "canceled", current_period_end: null, is_grandfathered: false }, now);
    expect(e.isPro).toBe(false);
    expect(e.state).toBe("free");
  });

  it("active subscription beats an expired trial", () => {
    const e = computeEntitlement({ trial_ends_at: daysFromNow(-5), subscription_status: "active", current_period_end: daysFromNow(25), is_grandfathered: false }, now);
    expect(e.isPro).toBe(true);
  });
});

describe("isProUser — server-side gate helper", () => {
  it("null profile (no row yet) is treated as non-Pro so paid endpoints stay closed", () => {
    expect(isProUser(null, now)).toBe(false);
  });

  it("grandfathered flag alone grants access", () => {
    expect(isProUser({ trial_ends_at: null, subscription_status: "canceled", current_period_end: null, is_grandfathered: true }, now)).toBe(true);
  });
});
