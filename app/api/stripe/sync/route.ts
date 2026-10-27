// Post-checkout sync: Stripe redirects here after payment. We fetch the
// session server-side, write the subscription state to profiles, then
// bounce the user into the app as a confirmed Pro member. This makes
// activation deterministic instead of racing the webhook.
import { createClient } from "../../../../lib/supabase/server";
import { getStripe, intervalFromPriceId } from "../../../../lib/stripe-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? url.origin;

  const stripe = getStripe();
  if (!sessionId || !stripe) {
    return Response.redirect(`${origin}/pricing?error=1`, 302);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const userId = session.metadata?.user_id;
    if (!userId || session.payment_status !== "paid") {
      return Response.redirect(`${origin}/pricing?error=1`, 302);
    }

    let interval: string | null = session.metadata?.interval ?? null;
    let periodEnd: Date | null = null;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
      periodEnd = itemPeriodEnd ? new Date(itemPeriodEnd * 1000) : null;
      if (!interval) {
        const priceId = subscription.items.data[0]?.price?.id;
        interval = intervalFromPriceId(priceId);
      }
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        subscription_status: "active",
        stripe_subscription_id: subscriptionId,
        subscription_interval: interval,
        current_period_end: periodEnd ? periodEnd.toISOString() : null,
      })
      .eq("user_id", userId);

    if (error) console.error("[stripe/sync] profile update failed", error);
    return Response.redirect(`${origin}/?upgraded=1`, 302);
  } catch (error) {
    console.error("[stripe/sync]", error);
    return Response.redirect(`${origin}/pricing?error=1`, 302);
  }
}
