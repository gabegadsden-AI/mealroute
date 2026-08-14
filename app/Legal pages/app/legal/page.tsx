import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal — NutriPath",
  description: "Terms of Service and Privacy Policy for NutriPath.",
};

const styles = {
  body: {
    background: "#0a0a0a",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: "#e0e0e0",
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
    background: "#c0ff80",
    color: "#0a0a0a",
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
    color: "#8e9a91",
    margin: 0,
  },
  eyebrow: {
    fontSize: "11px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    color: "#8e9a91",
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
    color: "#8e9a91",
    margin: "0 0 40px",
  },
  card: {
    display: "block" as const,
    padding: "24px",
    borderRadius: "12px",
    background: "#121212",
    border: "1px solid #222",
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
    color: "#8e9a91",
    margin: 0,
  },
  arrow: {
    color: "#c0ff80",
    fontSize: "14px",
    marginTop: "8px",
    display: "block" as const,
  },
  footer: {
    marginTop: "48px",
    paddingTop: "24px",
    borderTop: "1px solid #222",
    fontSize: "12px",
    color: "#666",
    textAlign: "center" as const,
  },
  footerLink: {
    color: "#c0ff80",
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
            <p style={styles.brand}>NutriPath</p>
            <p style={styles.tagline}>Plan better. Track smarter.</p>
          </div>
        </div>

        <p style={styles.eyebrow}>LEGAL</p>
        <h1 style={styles.title}>Legal Documents</h1>
        <p style={styles.subtitle}>The policies that govern your use of NutriPath.</p>

        <a href="/terms" style={styles.card}>
          <p style={styles.cardTitle}>Terms of Service</p>
          <p style={styles.cardDesc}>The rules and expectations for using NutriPath, including our nutritional disclaimer and AI content policy.</p>
          <span style={styles.arrow}>Read Terms →</span>
        </a>

        <a href="/privacy" style={styles.card}>
          <p style={styles.cardTitle}>Privacy Policy</p>
          <p style={styles.cardDesc}>How NutriPath collects, uses, stores, and protects your personal and nutrition data.</p>
          <span style={styles.arrow}>Read Policy →</span>
        </a>

        <div style={styles.footer}>
          <p>
            <a href="/" style={styles.footerLink}>← Back to NutriPath</a>
          </p>
          <p style={{ marginTop: "8px" }}>© 2026 NutriPath. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
