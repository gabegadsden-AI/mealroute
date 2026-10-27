// ─────────────────────────────────────────────────────────────────────
// MealRoute entitlements — the single source of truth for the free/pro
// split. Pure logic, no I/O, fully unit-tested.
//
// Locked model (Oct 2026):
//   • 7-day no-card Pro trial from signup → auto-drop to Free tier
//   • Pro: $6.99/mo or $49/yr
//   • Grandfathered beta testers keep Pro forever
// ─────────────────────────────────────────────────────────────────────

export const TRIAL_DAYS = 7;
export const FREE_PLAN_LIMIT_DAYS = 3;
export const PRO_PRICE_MONTHLY_USD = 6.99;
export const PRO_PRICE_ANNUAL_USD = 49;

/** Subscription columns kept on the profiles table. */
export type SubscriptionFields = {
  trial_ends_at: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  is_grandfathered: boolean | null;
  subscription_interval?: string | null;
};

export type PlanState = "grandfathered" | "pro" | "trialing" | "free";

export type Entitlement = {
  isPro: boolean;
  state: PlanState;
  /** Whole days remaining in the trial (0 = last day, negative = expired). */
  trialDaysLeft: number;
  /** True when the trial expires within ~24h — triggers the reminder banner. */
  trialEndsSoon: boolean;
  /** Max days a generated plan may span. */
  maxPlanDays: number;
};

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function computeEntitlement(
  fields: SubscriptionFields | null | undefined,
  now: Date = new Date(),
): Entitlement {
  const trialEnd = fields?.trial_ends_at ? new Date(fields.trial_ends_at) : null;
  const trialDaysLeft = trialEnd ? daysBetween(now, trialEnd) : 0;
  const status = fields?.subscription_status ?? "trialing";

  // Grandfathered beta testers: Pro forever.
  if (fields?.is_grandfathered) {
    return { isPro: true, state: "grandfathered", trialDaysLeft: 0, trialEndsSoon: false, maxPlanDays: 7 };
  }

  // Active Stripe subscription. Stripe sends cancel_at_period_end as
  // status "active" until the period actually lapses, then "canceled".
  const periodEnd = fields?.current_period_end ? new Date(fields.current_period_end) : null;
  const periodActive = status === "active" && (!periodEnd || periodEnd.getTime() > now.getTime());
  if (periodActive) {
    return { isPro: true, state: "pro", trialDaysLeft: 0, trialEndsSoon: false, maxPlanDays: 7 };
  }

  // 7-day no-card trial. Auto-drops to Free when the clock runs out —
  // no cron needed, the timestamp does the work.
  if (status === "trialing" && trialEnd && trialEnd.getTime() > now.getTime()) {
    const trialEndsSoon = trialEnd.getTime() - now.getTime() <= 24 * 3_600_000;
    return { isPro: true, state: "trialing", trialDaysLeft, trialEndsSoon, maxPlanDays: 7 };
  }

  // Free tier.
  return { isPro: false, state: "free", trialDaysLeft, trialEndsSoon: false, maxPlanDays: FREE_PLAN_LIMIT_DAYS };
}

/** Server-side enforcement helper for API routes. */
export function isProUser(fields: SubscriptionFields | null | undefined, now: Date = new Date()): boolean {
  return computeEntitlement(fields, now).isPro;
}

/**
 * Feature gates. Flip any single line to change the free/pro split —
 * everything in the app reads from here.
 */
export const FEATURES = {
  aiPhotoAnalysis: "pro",
  planLengthDays: FREE_PLAN_LIMIT_DAYS,
  recipeCreator: "pro",
  planSharing: "pro",
  // Barcode scanning + verified products stay free: zero marginal cost
  // and the strongest daily-habit hook in the app.
  barcodeScanning: "free",
} as const;
