"use client";

import Link from "next/link";
import { useState } from "react";
import { Brand } from "../brand";
import { supabase } from "../../lib/supabase";
import { withSharedSnippet } from "../../lib/shared-snippet";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError(authError.message);
      setBusy(false);
      return;
    }
    window.location.replace(withSharedSnippet("/app"));
  }

  return (
    <main className="login-shell">
      <section className="login-card auth-form-card" aria-labelledby="login-title">
        <Brand />
        <h1 id="login-title">Sign in with email</h1>
        <p className="subtitle">Welcome back to Snipbase</p>
        <form className="email-form" onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <button className="email-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <p className="signup-prompt"><Link href="/">Back</Link><span aria-hidden="true"> · </span>New here? <a href="/signup" onClick={(e) => { e.currentTarget.href = withSharedSnippet("/signup"); }}>Create an account</a></p>
      </section>
    </main>
  );
}
