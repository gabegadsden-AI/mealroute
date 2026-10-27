// ─────────────────────────────────────────────────────────────────────
// Server-side Stripe helpers. All routes no-op safely when the keys
// aren't configured, so deploys work before Gabriel pastes the keys.
// ─────────────────────────────────────────────────────────────────────
import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) cached = new Stripe(key);
  return cached;
}

export type BillingInterval = "monthly" | "annual";

export function getPriceId(interval: BillingInterval): string | null {
  return interval === "annual"
    ? process.env.STRIPE_PRICE_ANNUAL ?? null
    : process.env.STRIPE_PRICE_MONTHLY ?? null;
}

/** Subscription interval inferred from a Stripe price id (metadata-free fallback). */
export function intervalFromPriceId(priceId: string | undefined): BillingInterval | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ANNUAL) return "annual";
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return "monthly";
  return null;
}
