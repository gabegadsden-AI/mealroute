"use client";
import "./../auth.css";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMessage(params.get("message") || "");
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span>NP</span><div><strong>NutriPath</strong><small>Plan better. Track smarter.</small></div></div>
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Log in to NutriPath</h1>
        <p className="auth-intro">Your meals, plans and nutrition history will be available on your signed-in devices.</p>
        {message && <div className="auth-message">{message}</div>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form className="auth-form" onSubmit={submit}>
          <label><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
          <div className="auth-form-row"><Link href="/auth/forgot-password">Forgot password?</Link></div>
          <button className="primary full" disabled={loading}>{loading ? "Logging in…" : "Log in"}</button>
        </form>
        <p className="auth-switch">New to NutriPath? <Link href="/auth/signup">Create an account</Link></p>
      </section>
    </main>
  );
}
