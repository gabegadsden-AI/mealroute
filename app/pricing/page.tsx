"use client";
// ─────────────────────────────────────────────────────────────────────
// /pricing — public pricing page for MealRoute Pro.
// ─────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { PRO_PRICE_MONTHLY_USD, PRO_PRICE_ANNUAL_USD, FREE_PLAN_LIMIT_DAYS } from "../../lib/entitlements";

const PRO_FEATURES = [
  "Unlimited AI photo analysis — snap a plate, get macros",
  "Full-week AI meal plans (free plan runs 3 days at a time)",
  "Recipe Creator with per-serving macros",
  "One-tap plan sharing via public links",
  "Every future Pro feature, same price",
];

const FREE_FEATURES = [
  "Manual meal logging with full macros",
  "USDA verified food search & barcode scanning",
  "3-day AI meal plans",
  "Grocery list & weekly nutrition summary",
  "Your data stays yours — forever",
];

export default function PricingPage() {
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

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #f7faf6, #eef4ee)",
      padding: "48px 20px 80px",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <a href="/" style={{ textDecoration: "none", color: "#3e8033", fontWeight: 800, fontSize: "18px", letterSpacing: "-.02em" }}>
        Meal<span style={{ color: "#1c2920" }}>Route</span>
      </a>

      <p className="eyebrow" style={{ marginTop: "28px" }}>PRICING</p>
      <h1 style={{ fontSize: "34px", margin: "0 0 10px", letterSpacing: "-.04em", textAlign: "center" }}>
        Eat smarter. Pay once it sticks.
      </h1>
      <p style={{ color: "#6f7d74", fontSize: "14px", textAlign: "center", maxWidth: "460px", lineHeight: 1.6, margin: "0 0 32px" }}>
        Every new member gets a <strong>7-day Pro trial — no card required</strong>.
        When it ends you drop to the Free plan automatically. Upgrade only if you love it.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "16px", maxWidth: "640px", width: "100%" }}>
        {/* Free */}
        <section style={{ background: "#fff", border: "1px solid #dfe6e0", borderRadius: "24px", padding: "24px" }}>
          <h2 style={{ margin: "0 0 2px", fontSize: "18px" }}>Free</h2>
          <p style={{ color: "#9aa49d", fontSize: "11px", margin: "0 0 14px", fontWeight: 700 }}>FOREVER — NO CARD</p>
          <p style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-.03em", margin: "0 0 18px" }}>$0</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "10px" }}>
            {FREE_FEATURES.map(f => (
              <li key={f} style={{ display: "flex", gap: "8px", fontSize: "12.5px", color: "#3d4a41", lineHeight: 1.45 }}>
                <span style={{ color: "var(--green-text)" }}>✓</span>{f}
              </li>
            ))}
          </ul>
        </section>

        {/* Pro */}
        <section style={{ background: "#fff", border: "2px solid var(--green)", borderRadius: "24px", padding: "24px", position: "relative" }}>
          <span style={{ position: "absolute", top: "-12px", right: "20px", background: "var(--green)", color: "#1c2920", fontSize: "10px", fontWeight: 800, padding: "5px 12px", borderRadius: "999px", letterSpacing: ".04em" }}>
            7-DAY FREE TRIAL INCLUDED
          </span>
          <h2 style={{ margin: "0 0 2px", fontSize: "18px" }}>Pro</h2>
          <p style={{ color: "#9aa49d", fontSize: "11px", margin: "0 0 14px", fontWeight: 700 }}>EVERYTHING, UNLIMITED</p>

          <button
            onClick={() => void startCheckout("annual")}
            disabled={loading !== null}
            style={{
              width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 16px", borderRadius: "14px", border: "none",
              background: "var(--green)", color: "#1c2920", fontWeight: 800,
              fontSize: "13px", cursor: loading ? "wait" : "pointer", marginBottom: "10px",
            }}
          >
            <span>Annual — ${PRO_PRICE_ANNUAL_USD.toFixed(2)}/yr</span>
            <span style={{ fontSize: "11px", opacity: 0.8 }}>${(PRO_PRICE_ANNUAL_USD / 12).toFixed(2)}/mo · save 41%</span>
          </button>
          <button
            onClick={() => void startCheckout("monthly")}
            disabled={loading !== null}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: "14px",
              border: "1px solid #dfe6e0", background: "transparent",
              fontSize: "12.5px", fontWeight: 700, color: "inherit", cursor: loading ? "wait" : "pointer",
            }}
          >
            Monthly — ${PRO_PRICE_MONTHLY_USD.toFixed(2)}/mo
          </button>

          <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "grid", gap: "10px" }}>
            {PRO_FEATURES.map(f => (
              <li key={f} style={{ display: "flex", gap: "8px", fontSize: "12.5px", color: "#3d4a41", lineHeight: 1.45 }}>
                <span style={{ color: "var(--green-text)" }}>✓</span>{f}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {error && <p style={{ color: "#c75b39", fontSize: "13px", marginTop: "18px" }}>{error}</p>}

      <p style={{ color: "#9aa49d", fontSize: "11px", marginTop: "28px", textAlign: "center", lineHeight: 1.6, maxWidth: "440px" }}>
        Free plan keeps manual logging, barcode scanning, and {FREE_PLAN_LIMIT_DAYS}-day plans forever.
        No lock-outs, no data hostage — cancel Pro anytime and keep everything you logged.
      </p>
    </main>
  );
}
