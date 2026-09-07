"use client";

import { useState } from "react";

type Props = {
  hasCalorieGoal: boolean;
  hasMacroGoals: boolean;
  onOpenGoals: () => void;
};

/**
 * Shows a dismissible banner at the top of the dashboard when the user's
 * profile is missing a calorie goal or macro targets. Clicking the CTA opens
 * the existing goals editor modal — no new form needed.
 */
export default function ProfileCompletionBanner({ hasCalorieGoal, hasMacroGoals, onOpenGoals }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (hasCalorieGoal && hasMacroGoals) return null;

  const missing: string[] = [];
  if (!hasCalorieGoal) missing.push("daily calorie target");
  if (!hasMacroGoals) missing.push("protein, carb & fat goals");

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "12px 14px",
        marginBottom: "16px",
        borderRadius: "14px",
        background: "linear-gradient(135deg, #fff8e9, #fdf3e2)",
        border: "1px solid #c75b39",
      }}
    >
      <span
        style={{
          fontSize: "18px",
          lineHeight: 1.2,
          flex: "0 0 auto",
          marginTop: "-2px",
        }}
      >
        ⚠️
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: "0 0 2px",
            fontSize: "12px",
            fontWeight: 700,
            color: "#c75b39",
            letterSpacing: "-0.01em",
          }}
        >
          Your profile is incomplete
        </p>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: "11px",
            color: "#887351",
            lineHeight: 1.5,
          }}
        >
          You&apos;re missing: {missing.join(", ")}. Your meal plans will use a
          default estimate until you set them.
        </p>
        <button
          onClick={() => {
            setDismissed(true);
            onOpenGoals();
          }}
          style={{
            border: "1px solid #c75b39",
            borderRadius: "10px",
            background: "rgba(238, 158, 120, 0.12)",
            color: "#c75b39",
            padding: "6px 14px",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Set my goals →
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          border: "none",
          background: "transparent",
          color: "#6f7d74",
          fontSize: "14px",
          cursor: "pointer",
          padding: "0",
          flex: "0 0 auto",
        }}
      >
        ✕
      </button>
    </div>
  );
}
