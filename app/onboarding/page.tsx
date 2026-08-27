import { redirect } from "next/navigation";
import { profileSelect, type MealRouteProfile } from "../../lib/profile";
import { createClient } from "../../lib/supabase/server";
import OnboardingWizard from "./wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.onboarding_completed) redirect("/");

  return (
    <OnboardingWizard
      userId={userId}
      initialProfile={(profile as MealRouteProfile | null) || null}
    />
  );
}
