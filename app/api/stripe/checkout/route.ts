// Stripe Checkout — creates a subscription checkout session for the
// signed-in user. 401 if signed out, 503 if Stripe isn't configured yet.
import { createClient } from "../../../../lib/supabase/server";
import { getStripe, getPriceId, type BillingInterval } from "../../../../lib/stripe-server";

function siteOrigin(request: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return Response.json({ error: "Sign in to upgrade." }, { status: 401 });
    }
    const userId = authData.user.id;

    const body = (await request.json().catch(() => ({}))) as { interval?: string };
    const interval: BillingInterval = body.interval === "annual" ? "annual" : "monthly";

    const stripe = getStripe();
    const priceId = getPriceId(interval);
    if (!stripe || !priceId) {
      return Response.json(
        { error: "Checkout isn't configured yet — billing launches shortly." },
        { status: 503 },
      );
    }

    // Existing Stripe customer, or create one for this user.
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { user_id: userId },
        email: authData.user.email ?? undefined,
      });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userId);
    }

    const origin = siteOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: { metadata: { user_id: userId, interval } },
      metadata: { user_id: userId, interval },
      success_url: `${origin}/api/stripe/sync?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=1`,
    });

    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/checkout]", error);
    return Response.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
