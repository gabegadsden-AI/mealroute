// Stripe billing portal — lets Pro members manage or cancel their
// subscription without emailing support.
import { createClient } from "../../../../lib/supabase/server";
import { getStripe } from "../../../../lib/stripe-server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return Response.json({ error: "Sign in first." }, { status: 401 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return Response.json({ error: "Billing isn't configured yet." }, { status: 503 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", authData.user.id)
      .single();

    const customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      return Response.json({ error: "No billing account found for your profile." }, { status: 400 });
    }

    const url = new URL(request.url);
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? url.origin;

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/?manage=1`,
    });
    return Response.json({ url: portal.url });
  } catch (error) {
    console.error("[stripe/portal]", error);
    return Response.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}
