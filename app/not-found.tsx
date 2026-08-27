import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "70vh",
      padding: "24px",
      textAlign: "center",
      color: "#11251a",
    }}>
      <p style={{ fontSize: "48px", fontWeight: 800, letterSpacing: "-0.04em", marginBottom: "8px" }}>
        404
      </p>
      <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>
        This page doesn&apos;t exist.
      </h2>
      <p style={{ fontSize: "13px", color: "#738078", marginBottom: "20px" }}>
        The link may be broken or the page may have moved.
      </p>
      <Link
        href="/"
        style={{
          background: "#11251a",
          color: "#fff",
          borderRadius: "14px",
          padding: "13px 24px",
          fontSize: "12px",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Back to MealRoute
      </Link>
    </div>
  );
}
