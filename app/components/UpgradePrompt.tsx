"use client";
// ─────────────────────────────────────────────────────────────────────
// UpgradePrompt — the paywall modal. Shows contextual copy for the
// feature that hit the gate, the two price cards, and starts checkout.
// ─────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { PRO_PRICE_MONTHLY_USD, PRO_PRICE_ANNUAL_USD } from "../../lib/entitlements";

export type UpgradeFeature = "photoAnalysis" | "planLength" | "recipeCreator" | "planSharing" | "general";

const COPY: Record<UpgradeFeature, { title: string; body: string }> = {
  photoAnalysis: {
    title: "AI photo analysis is a Pro feature",
    body: "Snap a photo and MealRoute reads the plate — meal name, calories, and full macros in seconds. Free plan keeps manual logging and search.",
  },
  planLength: {
    title: "Plans beyond 3 days are Pro",
    body: "Free plans run 3 days at a time. Pro generates your whole week in one tap, calibrated to your macro targets.",
  },
  recipeCreator: {
    title: "Recipe Creator is a Pro feature",
    body: "Turn any recipe into per-serving macros and log it in one tap. Included with Pro, along with weekly plans and photo analysis.",
  },
  planSharing: {
    title: "Plan sharing is a Pro feature",
    body: "Publish a clean public link to your meal plan — perfect for coaches, mates, and accountability partners. Included with Pro.",
  },
  general: {
    title: "Upgrade to MealRoute Pro",
    body: "Unlimited AI photo analysis, full-week AI meal plans, recipe creator, and plan sharing — everything you had in your trial.",
  },
};

export function UpgradePrompt({ feature, onClose }: { feature: UpgradeFeature; onClose: () => void }) {
  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);
  const [error, setError] = useState("");

  async function startCheckout(interval: "monthly" | "annual") {
    setLoading(interval);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = "/landing";
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Could not start checkout. Please try again.");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(null);
    }
  }

  const copy = COPY[feature];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90, display: "flex",
        alignItems: "center", justifyContent: "center", padding: "16px",
        background: "rgba(20, 28, 22, 0.45)", backdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Upgrade to Pro"
        style={{
          width: "100%", maxWidth: "420px", maxHeight: "88vh", overflowY: "auto",
          background: "#ffffff", borderRadius: "24px", padding: "24px",
          boxShadow: "0 24px 64px rgba(20, 28, 22, 0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: "none", background: "transparent", fontSize: "20px", color: "#9aa49d", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <p className="eyebrow" style={{ margin: "0 0 6px" }}>MEALROUTE PRO</p>
        <h2 style={{ fontSize: "22px", margin: "0 0 8px", letterSpacing: "-.03em" }}>{copy.title}</h2>
        <p style={{ color: "#6f7d74", fontSize: "13px", lineHeight: 1.55, margin: "0 0 18px" }}>{copy.body}</p>

        <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
          <button
            onClick={() => void startCheckout("annual")}
            disabled={loading !== null}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
              padding: "16px", borderRadius: "16px", border: "2px solid var(--green)",
              background: "var(--green)", color: "#1c2920", cursor: loading ? "wait" : "pointer",
            }}
          >
            <span style={{ textAlign: "left" }}>
              <strong style={{ display: "block", fontSize: "14px" }}>Pro Annual</strong>
              <span style={{ fontSize: "11px", opacity: 0.75 }}>Best value — 2 months free</span>
            </span>
            <span style={{ textAlign: "right" }}>
              <strong style={{ display: "block", fontSize: "16px" }}>${PRO_PRICE_ANNUAL_USD.toFixed(2)}/yr</strong>
              <span style={{ fontSize: "11px", opacity: 0.75 }}>${(PRO_PRICE_ANNUAL_USD / 12).toFixed(2)}/mo</span>
            </span>
          </button>

          <button
            onClick={() => void startCheckout("monthly")}
            disabled={loading !== null}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
              padding: "16px", borderRadius: "16px", border: "1px solid #dfe6e0", background: "transparent",
              color: "inherit", cursor: loading ? "wait" : "pointer",
            }}
          >
            <span style={{ textAlign: "left" }}>
              <strong style={{ display: "block", fontSize: "14px" }}>Pro Monthly</strong>
              <span style={{ fontSize: "11px", opacity: 0.75 }}>Cancel anytime</span>
            </span>
            <span style={{ textAlign: "right" }}>
              <strong style={{ display: "block", fontSize: "16px" }}>${PRO_PRICE_MONTHLY_USD.toFixed(2)}/mo</strong>
              <span style={{ fontSize: "11px", opacity: 0.75 }}>USD</span>
            </span>
          </button>
        </div>

        {error && <p style={{ color: "#c75b39", fontSize: "12px", margin: "12px 0 0" }}>{error}</p>}

        <p style={{ color: "#9aa49d", fontSize: "10.5px", lineHeight: 1.5, margin: "16px 0 0", textAlign: "center" }}>
          7-day Pro trial included at signup — no card needed.<br />
          Cancel anytime. Your meal history stays yours, always.
        </p>
      </div>
    </div>
  );
}
