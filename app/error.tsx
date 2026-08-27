"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MealRoute] Route error:", error);
  }, [error]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      padding: "24px",
      textAlign: "center",
      color: "#11251a",
    }}>
      <p style={{ fontSize: "11px", letterSpacing: "0.15em", fontWeight: 800, color: "#9aa49d", marginBottom: "12px" }}>
        SOMETHING WENT WRONG
      </p>
      <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>
        That didn&apos;t load properly.
      </h2>
      <p style={{ fontSize: "13px", color: "#738078", marginBottom: "20px", maxWidth: "320px" }}>
        Your data is safe. Try again, or refresh the page if the issue persists.
      </p>
      <button
        onClick={reset}
        style={{
          background: "#11251a",
          color: "#fff",
          border: "none",
          borderRadius: "14px",
          padding: "13px 24px",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
