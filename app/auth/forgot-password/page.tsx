"use client";
import "../../auth.css";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>NP</span><div><strong>NutriPath</strong><small>Plan better. Track smarter.</small></div></div>
        <p className="eyebrow">PASSWORD RESET</p>
        <h1>{sent ? "Check your email" : "Reset your password"}</h1>
        {sent ? (
          <div className="auth-confirmation">
            <p>If an account exists for <strong>{email}</strong>, a reset link has been sent.</p>
            <Link className="primary full link-button" href="/auth/login">Return to login</Link>
          </div>
        ) : (
          <>
            <p className="auth-intro">Enter the email address connected to your account.</p>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <form className="auth-form" onSubmit={submit}>
              <label><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
              <button className="primary full" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
            </form>
            <p className="auth-switch"><Link href="/auth/login">Back to login</Link></p>
          </>
        )}
      </section>
    </main>
  );
}
