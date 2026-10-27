// Stripe webhook — the source of truth for subscription lifecycle.
// Configure in the Stripe dashboard → Webhooks → endpoint:
//   https://mealroute.app/api/stripe/webhook
// Events: checkout.session.completed, customer.subscription.updated,
//         customer.subscription.deleted
import Stripe, { type Stripe as StripeType } from "stripe";
import { createClient } from "../../../../lib/supabase/server";
import { getStripe, intervalFromPriceId } from "../../../../lib/stripe-server";

async function updateUserByCustomerId(
  customerId: string,
  update: Record<string, unknown>,
  lookupBySubscription = false,
) {
  const supabase = await createClient();
  const query = supabase.from("profiles").update(update);
  const { error } = await (lookupBySubscription
    ? query.eq("stripe_subscription_id", customerId)
    : query.eq("stripe_customer_id", customerId));
  if (error) console.error("[stripe/webhook] profile update failed", error);
}

async function applySubscriptionState(stripe: StripeType, subscription: Stripe.Subscription) {
  const interval =
    subscription.metadata?.interval ?? intervalFromPriceId(subscription.items.data[0]?.price?.id);
  const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
  const periodEnd = itemPeriodEnd ? new Date(itemPeriodEnd * 1000).toISOString() : null;

  if (subscription.status === "active" || subscription.status === "trialing") {
    await updateUserByCustomerId(subscription.customer as string, {
      subscription_status: "active",
      stripe_subscription_id: subscription.id,
      subscription_interval: interval,
      current_period_end: periodEnd,
    });
  } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
    // Auto-drop to Free — the user keeps the app and their data.
    await updateUserByCustomerId(subscription.id, {
      subscription_status: "canceled",
      current_period_end: null,
    }, true);
    // Also match by customer in case the profile row still points at the sub.
    await updateUserByCustomerId(subscription.customer as string, {
      subscription_status: "canceled",
      current_period_end: null,
    });
  }
  // past_due / incomplete: keep existing state; Stripe retries, then
  // sends canceled/deleted which we handle above.
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return Response.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          await applySubscriptionState(stripe, await stripe.subscriptions.retrieve(
            typeof session.subscription === "string" ? session.subscription : "",
          ));
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        await applySubscriptionState(stripe, event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await updateUserByCustomerId(subscription.id, {
          subscription_status: "canceled",
          current_period_end: null,
        }, true);
        await updateUserByCustomerId(subscription.customer as string, {
          subscription_status: "canceled",
          current_period_end: null,
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`[stripe/webhook] ${event.type}`, error);
    return Response.json({ error: "Handler failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
