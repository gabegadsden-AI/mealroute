"use client";
import "../../auth.css";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      window.location.assign("/onboarding");
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>NP</span><div><strong>NutriPath</strong><small>Plan better. Track smarter.</small></div></div>
        {sent ? (
          <div className="auth-confirmation">
            <p className="eyebrow">CHECK YOUR EMAIL</p>
            <h1>Confirm your account</h1>
            <p>We sent a verification link to <strong>{email}</strong>. Open it to continue to onboarding.</p>
            <Link className="primary full link-button" href="/auth/login">Return to login</Link>
          </div>
        ) : (
          <>
            <p className="eyebrow">CREATE YOUR ACCOUNT</p>
            <h1>Start with NutriPath</h1>
            <p className="auth-intro">Create an account before setting your nutrition goals.</p>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <form className="auth-form" onSubmit={submit}>
              <label><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
              <label><span>Password</span><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /><small>At least 8 characters</small></label>
              <label><span>Confirm password</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>
              <button className="primary full" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
            </form>
            <p className="auth-switch">Already have an account? <Link href="/auth/login">Log in</Link></p>
          </>
        )}
      </section>
    </main>
  );
}
