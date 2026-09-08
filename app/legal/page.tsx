import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal — MealRoute",
  description: "Terms of Service and Privacy Policy for MealRoute.",
};

const styles = {
  body: {
    background: "#ffffff",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: "#dfe6e0",
    lineHeight: 1.7,
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "80px 24px",
  },
  header: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "12px",
    marginBottom: "48px",
  },
  logo: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    background: "#5db04d",
    color: "#1c2920",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    fontWeight: 800,
    fontSize: "18px",
    flexShrink: 0,
  },
  brand: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#ffffff",
    margin: 0,
  },
  tagline: {
    fontSize: "12px",
    color: "#6f7d74",
    margin: 0,
  },
  eyebrow: {
    fontSize: "11px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    color: "#6f7d74",
    marginBottom: "8px",
  },
  title: {
    fontSize: "32px",
    fontWeight: 800,
    color: "#ffffff",
    letterSpacing: "-0.03em",
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#6f7d74",
    margin: "0 0 40px",
  },
  card: {
    display: "block" as const,
    padding: "24px",
    borderRadius: "12px",
    background: "#ffffff",
    border: "1px solid #1c2920",
    textDecoration: "none",
    marginBottom: "16px",
    transition: "border-color 0.2s",
  },
  cardTitle: {
    fontSize: "17px",
    fontWeight: 700,
    color: "#ffffff",
    margin: "0 0 6px",
  },
  cardDesc: {
    fontSize: "13px",
    color: "#6f7d74",
    margin: 0,
  },
  arrow: {
    color: "var(--green-text)",
    fontSize: "14px",
    marginTop: "8px",
    display: "block" as const,
  },
  footer: {
    marginTop: "48px",
    paddingTop: "24px",
    borderTop: "1px solid #1c2920",
    fontSize: "12px",
    color: "#6f7d74",
    textAlign: "center" as const,
  },
  footerLink: {
    color: "var(--green-text)",
    textDecoration: "none",
    fontSize: "13px",
  },
};

export default function LegalPage() {
  return (
    <div style={styles.body}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logo}>NP</div>
          <div>
            <p style={styles.brand}>MealRoute</p>
            <p style={styles.tagline}>Plan your meals. Track your way.</p>
          </div>
        </div>

        <p style={styles.eyebrow}>LEGAL</p>
        <h1 style={styles.title}>Legal Documents</h1>
        <p style={styles.subtitle}>The policies that govern your use of MealRoute.</p>

        <a href="/terms" style={styles.card}>
          <p style={styles.cardTitle}>Terms of Service</p>
          <p style={styles.cardDesc}>The rules and expectations for using MealRoute, including our nutritional disclaimer and AI content policy.</p>
          <span style={styles.arrow}>Read Terms →</span>
        </a>

        <a href="/privacy" style={styles.card}>
          <p style={styles.cardTitle}>Privacy Policy</p>
          <p style={styles.cardDesc}>How MealRoute collects, uses, stores, and protects your personal and nutrition data.</p>
          <span style={styles.arrow}>Read Policy →</span>
        </a>

        <div style={styles.footer}>
          <p>
            <a href="/" style={styles.footerLink}>← Back to MealRoute</a>
          </p>
          <p style={{ marginTop: "8px" }}>© 2026 MealRoute. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
