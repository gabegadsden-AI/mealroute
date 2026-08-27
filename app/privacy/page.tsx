import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — MealRoute",
  description: "Privacy Policy for MealRoute, a proactive nutrition planning app.",
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
    maxWidth: "720px",
    margin: "0 auto",
    padding: "48px 24px 80px",
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
  updated: {
    fontSize: "13px",
    color: "#8e9a91",
    margin: "0 0 40px",
  },
  section: {
    marginBottom: "32px",
  },
  h2: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#ffffff",
    margin: "0 0 12px",
    letterSpacing: "-0.02em",
  },
  p: {
    fontSize: "14px",
    color: "#b0b0b0",
    margin: "0 0 12px",
  },
  ul: {
    fontSize: "14px",
    color: "#b0b0b0",
    margin: "0 0 12px",
    paddingLeft: "20px",
  },
  li: {
    marginBottom: "6px",
  },
  accent: {
    color: "#c0ff80",
  },
  link: {
    color: "#c0ff80",
    textDecoration: "none",
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

export default function PrivacyPolicy() {
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
        <h1 style={styles.title}>Privacy Policy</h1>
        <p style={styles.updated}>Last updated: August 14, 2026</p>

        <div style={styles.section}>
          <h2 style={styles.h2}>1. Overview</h2>
          <p style={styles.p}>
            MealRoute (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is a nutrition planning app that helps you track meals, generate AI meal plans, and monitor your nutritional intake. This Privacy Policy explains what data we collect, how we use it, and the choices you have.
          </p>
          <p style={styles.p}>
            We are committed to protecting your privacy and being transparent about our data practices.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>2. Information We Collect</h2>

          <p style={styles.p}><strong style={styles.accent}>Account Information</strong></p>
          <ul style={styles.ul}>
            <li style={styles.li}>Email address (for authentication and communication)</li>
            <li style={styles.li}>Password (stored as a secure hash via Supabase Auth — we never see the plain text)</li>
          </ul>

          <p style={styles.p}><strong style={styles.accent}>Profile &amp; Nutrition Data</strong></p>
          <ul style={styles.ul}>
            <li style={styles.li}>Age, sex, height, weight, and activity level (for calorie calculations)</li>
            <li style={styles.li}>Nutrition goals (e.g., lose weight, maintain, gain muscle)</li>
            <li style={styles.li}>Custom macro targets (protein, carbs, fat)</li>
            <li style={styles.li}>Weight progress logs over time</li>
          </ul>

          <p style={styles.p}><strong style={styles.accent}>Food &amp; Meal Data</strong></p>
          <ul style={styles.ul}>
            <li style={styles.li}>Food preferences and saved foods in your palette</li>
            <li style={styles.li}>Meal slot assignments (breakfast, lunch, dinner, snack)</li>
            <li style={styles.li}>Daily meal logs and nutritional intake history</li>
            <li style={styles.li}>AI-generated meal plans you accept or reject</li>
            <li style={styles.li}>Grocery lists derived from your meal plans</li>
          </ul>

          <p style={styles.p}><strong style={styles.accent}>Photo Data</strong></p>
          <ul style={styles.ul}>
            <li style={styles.li}>Meal photos you upload for AI analysis</li>
            <li style={styles.li}>AI-generated nutritional estimates from those photos</li>
          </ul>

          <p style={styles.p}><strong style={styles.accent}>Water &amp; Lifestyle Data</strong></p>
          <ul style={styles.ul}>
            <li style={styles.li}>Daily water intake logs</li>
            <li style={styles.li}>Water intake goals</li>
          </ul>

          <p style={styles.p}><strong style={styles.accent}>Usage Data</strong></p>
          <ul style={styles.ul}>
            <li style={styles.li}>Device type and browser information</li>
            <li style={styles.li}>App interactions and feature usage (anonymized)</li>
            <li style={styles.li}>Error logs for debugging and service improvement</li>
          </ul>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>3. How We Use Your Data</h2>
          <p style={styles.p}>We use your data to:</p>
          <ul style={styles.ul}>
            <li style={styles.li}>Provide personalized meal plans and nutrition tracking</li>
            <li style={styles.li}>Calculate calorie and macro targets based on your profile</li>
            <li style={styles.li}>Analyze meal photos and return nutritional estimates</li>
            <li style={styles.li}>Generate weekly grocery lists from your meal plans</li>
            <li style={styles.li}>Track your water intake and weight progress over time</li>
            <li style={styles.li}>Sync your data across devices when logged in</li>
            <li style={styles.li}>Improve our AI models and food database accuracy</li>
            <li style={styles.li}>Send important account or service-related notifications</li>
          </ul>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>4. How We Store Your Data</h2>
          <p style={styles.p}>
            Your data is stored securely using <strong style={styles.accent}>Supabase</strong>, a PostgreSQL-based platform with row-level security (RLS). This means:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>Your nutrition data is tied to your authenticated user ID</li>
            <li style={styles.li}>Other users cannot access your data</li>
            <li style={styles.li}>Data is encrypted in transit (TLS) and at rest</li>
            <li style={styles.li}>Authentication is handled via Supabase Auth with secure password hashing</li>
          </ul>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>5. Third-Party Services</h2>
          <p style={styles.p}>MealRoute uses the following third-party services to operate:</p>
          <ul style={styles.ul}>
            <li style={styles.li}><strong style={styles.accent}>Supabase</strong> — Authentication and database storage. Your email and nutrition data are stored here. <a href="https://supabase.com/privacy" style={styles.link} target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a></li>
            <li style={styles.li}><strong style={styles.accent}>USDA FoodData Central</strong> — Public nutritional database used to look up food information. No personal data is sent. <a href="https://www.usda.gov/privacy" style={styles.link} target="_blank" rel="noopener noreferrer">USDA Privacy Policy</a></li>
            <li style={styles.li}><strong style={styles.accent}>OpenAI</strong> — Used for AI-powered meal photo analysis. When you upload a photo, it is sent to OpenAI for analysis. <a href="https://openai.com/privacy" style={styles.link} target="_blank" rel="noopener noreferrer">OpenAI Privacy Policy</a></li>
            <li style={styles.li}><strong style={styles.accent}>Google Analytics</strong> — Anonymized traffic analytics. <a href="https://policies.google.com/privacy" style={styles.link} target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></li>
          </ul>
          <p style={styles.p}>
            We do not sell your data to any third party.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>6. AI Photo Analysis</h2>
          <p style={styles.p}>
            When you upload a meal photo for analysis, the image is sent to OpenAI&apos;s API for processing. MealRoute uses the AI response to estimate ingredients, portions, and nutritional content.
          </p>
          <p style={styles.p}>
            We recommend not uploading photos containing sensitive personal information. Photos are processed on-demand and are not stored permanently on our servers unless you choose to save them to your meal log.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>7. Data Sharing</h2>
          <p style={styles.p}>
            We do <strong style={styles.accent}>not</strong> share your personal data with any third party for marketing or advertising purposes. Your data is only shared with the third-party services listed above for the sole purpose of operating MealRoute.
          </p>
          <p style={styles.p}>
            We may disclose data if required by law, court order, or to protect the rights, property, or safety of MealRoute or its users.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>8. Data Retention</h2>
          <p style={styles.p}>
            Your data is retained for as long as your account is active. When you delete your account:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>All nutrition data, meal logs, and food preferences are permanently deleted</li>
            <li style={styles.li}>Weight logs and water tracking history are deleted</li>
            <li style={styles.li}>Your account and authentication credentials are removed</li>
            <li style={styles.li}>Deletion is irreversible and cannot be undone</li>
          </ul>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>9. Your Privacy Rights</h2>
          <p style={styles.p}>You have the right to:</p>
          <ul style={styles.ul}>
            <li style={styles.li}><strong style={styles.accent}>Access</strong> — Request a copy of your personal data</li>
            <li style={styles.li}><strong style={styles.accent}>Rectification</strong> — Correct inaccurate data in your profile</li>
            <li style={styles.li}><strong style={styles.accent}>Erasure</strong> — Delete your account and all associated data</li>
            <li style={styles.li}><strong style={styles.accent}>Portability</strong> — Export your nutrition data</li>
            <li style={styles.li}><strong style={styles.accent}>Withdraw Consent</strong> — Stop using features that require certain data</li>
          </ul>
          <p style={styles.p}>
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:support@mealroute.app" style={styles.link}>support@mealroute.app</a>.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>10. Cookies &amp; Tracking</h2>
          <p style={styles.p}>
            MealRoute uses minimal cookies for authentication (keeping you logged in). We use Google Analytics for anonymized traffic analysis. We do not use tracking cookies for advertising.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>11. Children&apos;s Privacy</h2>
          <p style={styles.p}>
            MealRoute is not directed at children under 16. We do not knowingly collect data from anyone under 16. If you believe a minor has registered an account, please contact us and we will delete it.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>12. International Users</h2>
          <p style={styles.p}>
            MealRoute is available globally. If you are accessing the Service from outside New Zealand, your data may be processed and stored in servers located in other countries. By using the Service, you consent to this transfer of data.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>13. Security</h2>
          <p style={styles.p}>
            We take reasonable measures to protect your data, including encryption in transit (TLS) and at rest, secure authentication via Supabase, and row-level security policies that prevent unauthorized access. However, no system is 100% secure, and we cannot guarantee absolute security.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>14. Changes to This Policy</h2>
          <p style={styles.p}>
            We may update this Privacy Policy from time to time. We will notify users of significant changes through the app or by email. The updated date at the top of this page reflects the most recent revision.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>15. Contact</h2>
          <p style={styles.p}>
            Questions about your privacy? Contact us at{" "}
            <a href="mailto:support@mealroute.app" style={styles.link}>support@mealroute.app</a>.
          </p>
        </div>

        <div style={styles.footer}>
          <p>
            <a href="/" style={styles.footerLink}>← Back to MealRoute</a>
            <span style={{ margin: "0 12px", color: "#333" }}>·</span>
            <a href="/terms" style={styles.footerLink}>Terms of Service</a>
          </p>
          <p style={{ marginTop: "8px" }}>© 2026 MealRoute. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
