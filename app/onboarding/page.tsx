import { redirect } from "next/navigation";
import { profileSelect, type NutriPathProfile } from "../../lib/profile";
import { createClient } from "../../lib/supabase/server";
import OnboardingWizard from "./wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

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
      initialProfile={(profile as NutriPathProfile | null) || null}
    />
  );
}
