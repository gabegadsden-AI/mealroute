"use client";

import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    window.location.assign("/auth/login?message=Password updated. Log in with your new password.");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>NP</span><div><strong>NutriPath</strong><small>Plan better. Track smarter.</small></div></div>
        <p className="eyebrow">NEW PASSWORD</p>
        <h1>Choose a new password</h1>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form className="auth-form" onSubmit={submit}>
          <label><span>New password</span><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label>
          <label><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>
          <button className="primary full" disabled={loading}>{loading ? "Updating…" : "Update password"}</button>
        </form>
      </section>
    </main>
  );
}
