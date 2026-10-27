"use client";
// ─────────────────────────────────────────────────────────────────────
// PlanBanner — slim status bar under the topbar showing trial countdown,
// free-plan upgrade CTA, or Pro manage link. The day-6 "trial ends
// tomorrow" reminder lives here.
// ─────────────────────────────────────────────────────────────────────
import { type PlanState } from "../../lib/entitlements";

export function PlanBanner({
  state,
  trialDaysLeft,
  trialEndsSoon,
  subscriptionStatus,
  onUpgrade,
  onPricing,
  onManage,
}: {
  state: PlanState;
  trialDaysLeft: number;
  trialEndsSoon: boolean;
  subscriptionStatus: string | null;
  onUpgrade: () => void;
  onPricing: () => void;
  onManage: () => void;
}) {
  // Grandfathered founding members get a quiet badge, no nagging.
  if (state === "grandfathered") {
    return (
      <div style={{
        margin: "0 0 12px", padding: "8px 14px", borderRadius: "12px",
        background: "rgba(74,143,58,0.08)", border: "1px solid rgba(74,143,58,0.18)",
        display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--green-text)", fontWeight: 700,
      }}>
        <span>💚 Founding Member — Pro, on the house</span>
      </div>
    );
  }

  if (state === "trialing") {
    const message = trialEndsSoon
      ? "Your Pro trial ends tomorrow — photo analysis, weekly plans and recipes lock when it does."
      : `Pro trial — ${trialDaysLeft <= 0 ? 1 : trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left.`;
    return (
      <div style={{
        margin: "0 0 12px", padding: "10px 14px", borderRadius: "12px",
        background: trialEndsSoon ? "rgba(93,176,77,0.14)" : "rgba(74,143,58,0.08)",
        border: `1px solid ${trialEndsSoon ? "rgba(93,176,77,0.4)" : "rgba(74,143,58,0.18)"}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
        fontSize: "11.5px", color: "#3d4a41", flexWrap: "wrap",
      }}>
        <span style={{ fontWeight: trialEndsSoon ? 700 : 500 }}>{message}</span>
        <button onClick={onUpgrade} className="primary" style={{ padding: "7px 14px", fontSize: "10.5px", borderRadius: "10px" }}>
          Keep Pro — $6.99/mo or $49/yr
        </button>
      </div>
    );
  }

  if (state === "pro") {
    return (
      <div style={{
        margin: "0 0 12px", padding: "8px 14px", borderRadius: "12px",
        background: "rgba(74,143,58,0.08)", border: "1px solid rgba(74,143,58,0.18)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
        fontSize: "11px", color: "var(--green-text)", fontWeight: 700,
      }}>
        <span>✨ MealRoute Pro — everything unlocked</span>
        {subscriptionStatus === "active" && (
          <button onClick={onManage} style={{ border: "none", background: "transparent", color: "var(--green-text)", fontSize: "10.5px", fontWeight: 700, textDecoration: "underline", cursor: "pointer", padding: 0 }}>
            Manage subscription
          </button>
        )}
      </div>
    );
  }

  // Free tier: persistent, polite upgrade nudge.
  return (
    <div style={{
      margin: "0 0 12px", padding: "10px 14px", borderRadius: "12px",
      background: "linear-gradient(120deg, #ffffff, #f4f8f5)", border: "1px solid #dfe6e0",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
      fontSize: "11.5px", color: "#6f7d74", flexWrap: "wrap",
    }}>
      <span><strong style={{ color: "#3d4a41" }}>Free plan</strong> · 3-day plans & manual logging stay free</span>
      <span style={{ display: "flex", gap: "8px" }}>
        <button onClick={onUpgrade} className="primary" style={{ padding: "7px 14px", fontSize: "10.5px", borderRadius: "10px" }}>
          Upgrade to Pro
        </button>
        <button onClick={onPricing} style={{ border: "none", background: "transparent", color: "#9aa49d", fontSize: "10.5px", fontWeight: 700, textDecoration: "underline", cursor: "pointer", padding: 0 }}>
          Compare plans
        </button>
      </span>
    </div>
  );
}
