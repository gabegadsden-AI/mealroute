import { createClient } from "../../../lib/supabase/server";
import {
  createSharedPlan,
  listUserSharedPlans,
  deleteSharedPlan,
  type SharedPlanMeal,
} from "../../../lib/shared-plans";

type CreateShareRequest = {
  meals?: SharedPlanMeal[];
  planTitle?: string;
  weekStart?: string;
};

type DeleteShareRequest = {
  planId?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return Response.json({ error: "Sign in to share your plan." }, { status: 401 });
    }

    const body = (await request.json()) as CreateShareRequest;
    const meals = Array.isArray(body.meals) ? body.meals : [];
    const planTitle = String(body.planTitle || "My Meal Plan").slice(0, 200);
    const weekStart = body.weekStart || undefined;

    if (!meals.length) {
      return Response.json({ error: "Add meals to your plan before sharing." }, { status: 400 });
    }

    const shared = await createSharedPlan(supabase, data.user.id, meals, planTitle, weekStart);

    return Response.json(
      {
        shareUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/shared/${shared.shareToken}`,
        shareToken: shared.shareToken,
        planId: shared.id,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create share link.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return Response.json({ error: "Sign in to view your shared plans." }, { status: 401 });
    }

    const plans = await listUserSharedPlans(supabase, data.user.id);
    return Response.json({ plans });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load shared plans.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return Response.json({ error: "Sign in to manage your shared plans." }, { status: 401 });
    }

    const body = (await request.json()) as DeleteShareRequest;
    const planId = String(body.planId || "");
    if (!planId) {
      return Response.json({ error: "Plan ID is required." }, { status: 400 });
    }

    await deleteSharedPlan(supabase, data.user.id, planId);
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete shared plan.";
    return Response.json({ error: message }, { status: 500 });
  }
}
