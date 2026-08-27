import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — MealRoute",
  description: "Terms of Service for MealRoute, a proactive nutrition planning app.",
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
  divider: {
    height: "1px",
    background: "#222",
    border: "none",
    margin: "32px 0",
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

export default function TermsOfService() {
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
        <h1 style={styles.title}>Terms of Service</h1>
        <p style={styles.updated}>Last updated: August 14, 2026</p>

        <div style={styles.section}>
          <h2 style={styles.h2}>1. Acceptance of Terms</h2>
          <p style={styles.p}>
            By creating an account or using MealRoute (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use the Service.
          </p>
          <p style={styles.p}>
            MealRoute is provided by MealRoute (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), a nutrition planning application that helps users track meals, generate AI-powered meal plans, and monitor nutritional intake.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>2. Description of Service</h2>
          <p style={styles.p}>MealRoute provides the following features:</p>
          <ul style={styles.ul}>
            <li style={styles.li}>AI-generated meal plans based on your food preferences and nutrition goals</li>
            <li style={styles.li}>Food tracking with macro and calorie monitoring (protein, carbs, fat, fibre)</li>
            <li style={styles.li}>Photo-based meal analysis using AI image recognition</li>
            <li style={styles.li}>Weekly grocery lists generated from your meal plans</li>
            <li style={styles.li}>Water intake tracking and weight progress logging</li>
            <li style={styles.li}>Food palette management with meal slot assignment (breakfast, lunch, dinner, snack)</li>
          </ul>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>3. Eligibility &amp; Accounts</h2>
          <p style={styles.p}>
            You must be at least 16 years old to create a MealRoute account. You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account.
          </p>
          <p style={styles.p}>
            You agree to provide accurate information during registration and to keep your account information up to date.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>4. Acceptable Use</h2>
          <p style={styles.p}>You agree NOT to:</p>
          <ul style={styles.ul}>
            <li style={styles.li}>Use the Service for any unlawful purpose</li>
            <li style={styles.li}>Attempt to access another user&apos;s data without authorization</li>
            <li style={styles.li}>Upload malicious content or attempt to disrupt the Service</li>
            <li style={styles.li}>Reverse engineer, decompile, or disassemble any part of the Service</li>
            <li style={styles.li}>Use automated scripts or bots to access the Service in a way that exceeds normal usage</li>
          </ul>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>5. Nutritional Disclaimer</h2>
          <p style={styles.p}>
            <strong style={styles.accent}>MealRoute is not a medical device and does not provide medical advice.</strong>
          </p>
          <p style={styles.p}>
            All nutritional data, meal plans, calorie targets, and macro recommendations generated by the Service are for informational purposes only. Nutritional estimates may not be accurate for all foods, portions, or individuals.
          </p>
          <p style={styles.p}>
            Always consult a qualified healthcare professional or registered dietitian before making significant changes to your diet, especially if you have medical conditions, food allergies, or are pregnant.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>6. AI-Generated Content</h2>
          <p style={styles.p}>
            Meal plans and photo analyses are generated using artificial intelligence. AI-generated content may contain errors or inaccuracies. You are responsible for reviewing all suggestions before acting on them.
          </p>
          <p style={styles.p}>
            We do not guarantee that AI-generated meal plans will meet your specific dietary needs, restrictions, or allergies. Always verify ingredients and nutritional information independently.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>7. Data &amp; Privacy</h2>
          <p style={styles.p}>
            Your use of the Service is also governed by our{" "}
            <a href="/privacy" style={styles.link}>Privacy Policy</a>, which describes how we collect, use, and protect your data.
          </p>
          <p style={styles.p}>
            You retain ownership of all nutrition data, meal logs, and food preferences you create in the Service.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>8. Third-Party Services</h2>
          <p style={styles.p}>
            MealRoute integrates with third-party services including but not limited to:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>Supabase — for user authentication and secure data storage</li>
            <li style={styles.li}>USDA FoodData Central — for nutritional database information</li>
            <li style={styles.li}>OpenAI — for AI-powered meal photo analysis</li>
          </ul>
          <p style={styles.p}>
            We are not responsible for the practices or availability of these third-party services. Their use is subject to their respective terms and privacy policies.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>9. Service Availability</h2>
          <p style={styles.p}>
            We strive to maintain high availability but do not guarantee uninterrupted access. The Service may experience downtime for maintenance, updates, or reasons beyond our control.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>10. Limitation of Liability</h2>
          <p style={styles.p}>
            MealRoute is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied. To the fullest extent permitted by law, we are not liable for:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>Any direct, indirect, incidental, or consequential damages</li>
            <li style={styles.li}>Health outcomes resulting from reliance on nutritional data or meal plans</li>
            <li style={styles.li}>Loss of data due to service interruptions or account access issues</li>
            <li style={styles.li}>Actions taken based on AI-generated recommendations</li>
          </ul>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>11. Account Termination</h2>
          <p style={styles.p}>
            You may delete your account at any time. We reserve the right to suspend or terminate accounts that violate these Terms or pose a risk to the Service or other users.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>12. Changes to These Terms</h2>
          <p style={styles.p}>
            We may update these Terms from time to time. We will notify users of significant changes through the app or by email. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.h2}>13. Contact</h2>
          <p style={styles.p}>
            Questions about these Terms? Contact us at{" "}
            <a href="mailto:support@mealroute.app" style={styles.link}>support@mealroute.app</a>.
          </p>
        </div>

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
