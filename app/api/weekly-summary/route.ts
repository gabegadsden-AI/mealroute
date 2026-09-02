import { createClient } from "../../../lib/supabase/server";
import { buildWeeklySummary, renderWeeklySummaryHTML } from "../../../lib/weekly-summary";
import { profileSelect, type MealRouteProfile } from "../../../lib/profile";
import { weekStartKey } from "../../../lib/weekly-plan";

type SummaryRequest = {
  weekStart?: string;
  sendEmail?: boolean;
  email?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return Response.json({ error: "Sign in to view your weekly summary." }, { status: 401 });
    }

    const body = (await request.json()) as SummaryRequest;
    const weekStart = body.weekStart || weekStartKey(new Date());

    // Load profile for calorie goal
    const { data: profileData } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("user_id", data.user.id)
      .maybeSingle();

    const profile = profileData as MealRouteProfile | null;
    const goalCalories = Number(profile?.calorie_goal || profile?.suggested_calorie_goal || 0);

    const summary = await buildWeeklySummary(supabase, data.user.id, weekStart, goalCalories);

    // If email is requested, try to send it
    if (body.sendEmail && body.email) {
      const html = renderWeeklySummaryHTML(summary, profile?.name || "there");
      try {
        // Send email using the configured email service if available
        const emailEndpoint = process.env.EMAIL_API_ENDPOINT;
        const emailApiKey = process.env.EMAIL_API_KEY;
        if (emailEndpoint && emailApiKey) {
          await fetch(emailEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${emailApiKey}`,
            },
            body: JSON.stringify({
              to: body.email,
              subject: `Your MealRoute Weekly Summary — ${summary.weekStart} to ${summary.weekEnd}`,
              html,
            }),
          });
          return Response.json({ summary, emailSent: true });
        }
        // No email service configured — return the HTML for download/preview
        return Response.json({ summary, emailSent: false, html, message: "Email service not configured. Summary is available for viewing." });
      } catch {
        return Response.json({ summary, emailSent: false, message: "Email could not be sent. Summary is available for viewing." });
      }
    }

    return Response.json({ summary }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate weekly summary.";
    return Response.json({ error: message }, { status: 500 });
  }
}
