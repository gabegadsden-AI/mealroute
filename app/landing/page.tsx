import Link from "next/link";
import "./landing.css";

export default function LandingPage() {
  return (
    <main className="landing-page">
      {/* NAV */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <span className="brandmark">NP</span>
          <div>
            <strong>NutriPath</strong>
            <small>Plan better. Track smarter.</small>
          </div>
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#who">Who it&apos;s for</a>
          <Link href="/auth/login" className="landing-nav-login">Log in</Link>
          <Link href="/auth/signup" className="landing-nav-cta">Get started</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <span className="landing-badge">AI-Powered Nutrition Planning</span>
          <h1>Stop guessing.<br />Start planning.</h1>
          <p className="landing-hero-sub">
            NutriPath uses AI to build meal plans from the foods you already love.
            Snap a photo to log meals, scan barcodes for packaged foods, and get
            grocery lists automatically — all in one clean app.
          </p>
          <div className="landing-hero-cta">
            <Link href="/auth/signup" className="landing-cta-primary">Create free account</Link>
            <Link href="/auth/login" className="landing-cta-secondary">I already have one</Link>
          </div>
          <p className="landing-disclaimer">Nutrition values are estimates and not guaranteed. Always consult a healthcare professional for dietary advice.</p>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-phone-mockup">
            <div className="mockup-topbar">
              <span className="mockup-brandmark">NP</span>
              <div><strong>NutriPath</strong><small>Today</small></div>
              <div className="mockup-avatar">GG</div>
            </div>
            <div className="mockup-ring">
              <div>
                <strong>1,847</strong>
                <span>of 2,400 kcal</span>
              </div>
            </div>
            <div className="mockup-macros">
              <div><span>Protein</span><strong>142g</strong><i><b style={{ width: "72%" }} /></i></div>
              <div><span>Carbs</span><strong>198g</strong><i><b style={{ width: "65%" }} /></i></div>
              <div><span>Fat</span><strong>61g</strong><i><b style={{ width: "48%" }} /></i></div>
            </div>
            <div className="mockup-meal">
              <div className="mockup-meal-img berry" />
              <div className="mockup-meal-info">
                <span>BREAKFAST</span>
                <strong>Berry yogurt bowl</strong>
                <p>320 kcal · 24g protein</p>
              </div>
              <div className="mockup-check checked">✓</div>
            </div>
            <div className="mockup-meal">
              <div className="mockup-meal-img wrap" />
              <div className="mockup-meal-info">
                <span>LUNCH</span>
                <strong>Chicken Caesar wrap</strong>
                <p>540 kcal · 38g protein</p>
              </div>
              <div className="mockup-check checked">✓</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="landing-section" id="features">
        <p className="eyebrow">FEATURES</p>
        <h2>Everything you need to eat smarter</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <span className="feature-icon">◎</span>
            <h3>AI Meal Planning</h3>
            <p>Build balanced meal plans from your personal food palette. The AI suggests meals, you approve or swap — it&apos;s that simple.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">▣</span>
            <h3>Photo Food Logging</h3>
            <p>Snap a photo of your meal. NutriPath identifies the food, estimates portions, and calculates nutrition automatically.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">⌕</span>
            <h3>USDA Food Search</h3>
            <p>Search thousands of foods from the USDA database. Get exact calorie and macro values by gram weight.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">▣</span>
            <h3>Barcode Scanning <span className="coming-soon">Soon</span></h3>
            <p>Scan any packaged food barcode to pull nutrition data, correct label values, and save products for reuse.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">♢</span>
            <h3>Water Tracking</h3>
            <p>Set hydration goals and log water throughout the day. Stay on top of your intake with a simple tap.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">☑</span>
            <h3>Auto Grocery Lists</h3>
            <p>Accepted meal plans generate a grocery list automatically. Check items off as you shop — no more forgetting ingredients.</p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="landing-section" id="how">
        <p className="eyebrow">HOW IT WORKS</p>
        <h2>Three steps to better eating</h2>
        <div className="how-grid">
          <div className="how-card">
            <span className="how-number">1</span>
            <h3>Build your food palette</h3>
            <p>Add foods you enjoy from the USDA database. Your palette is what the AI uses to generate plans you&apos;ll actually want to eat.</p>
          </div>
          <div className="how-card">
            <span className="how-number">2</span>
            <h3>Generate &amp; review your plan</h3>
            <p>The AI builds a balanced meal plan. Review each meal, swap what you don&apos;t want, and accept the plan when you&apos;re happy.</p>
          </div>
          <div className="how-card">
            <span className="how-number">3</span>
            <h3>Track &amp; adjust</h3>
            <p>Log meals by photo, search, or barcode. Monitor your macros, weight, and water intake. Adjust your goals anytime.</p>
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="landing-section" id="who">
        <p className="eyebrow">WHO IT&apos;S FOR</p>
        <h2>Built for the way you eat</h2>
        <div className="who-grid">
          <div className="who-card">
            <span className="who-icon">💪</span>
            <h3>Fitness community</h3>
            <p>Hit your protein targets. Track macros to the gram. Meal prep with plans that match your training schedule.</p>
          </div>
          <div className="who-card">
            <span className="who-icon">⏰</span>
            <h3>Busy professionals</h3>
            <p>No time to plan meals? Generate a week&apos;s plan in seconds. Grocery list included. Just shop, cook, and log.</p>
          </div>
          <div className="who-card">
            <span className="who-icon">🌱</span>
            <h3>Everyday eaters</h3>
            <p>Want to eat better without obsessing? NutriPath makes nutrition tracking simple, visual, and actually sustainable.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta-section">
        <div className="landing-cta-card">
          <h2>Ready to eat smarter?</h2>
          <p>Create your free account and build your first AI meal plan in minutes.</p>
          <Link href="/auth/signup" className="landing-cta-primary big">Get started — it&apos;s free</Link>
          <p className="landing-disclaimer">Nutrition values are estimates and not guaranteed. NutriPath is not a substitute for professional medical or dietary advice.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-brand">
            <span className="brandmark">NP</span>
            <div>
              <strong>NutriPath</strong>
              <small>Plan better. Track smarter.</small>
            </div>
          </div>
          <div className="landing-footer-links">
            <Link href="/auth/login">Log in</Link>
            <Link href="/auth/signup">Sign up</Link>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
          </div>
          <p className="landing-footer-text">© 2026 NutriPath. All rights reserved. Nutrition values are estimates and not guaranteed.</p>
        </div>
      </footer>
    </main>
  );
}
