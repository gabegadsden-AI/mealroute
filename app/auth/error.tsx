"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MealRoute] Auth error:", error);
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
    }}>
      <h2 style={{ fontSize: "18px", color: "#11251a", marginBottom: "8px" }}>
        Authentication error
      </h2>
      <p style={{ fontSize: "13px", color: "#738078", marginBottom: "20px", maxWidth: "320px" }}>
        Something went wrong during sign-in. Try again or return to the login page.
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={reset}
          style={{
            background: "transparent",
            color: "#11251a",
            border: "1px solid #dfe5e0",
            borderRadius: "14px",
            padding: "13px 20px",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/auth/login"
          style={{
            background: "#11251a",
            color: "#fff",
            borderRadius: "14px",
            padding: "13px 20px",
            fontSize: "12px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
