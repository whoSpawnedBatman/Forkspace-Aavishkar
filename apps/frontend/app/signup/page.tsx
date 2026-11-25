"use client";

import Link from "next/link";
import { useState } from "react";
import { Brand } from "../brand";
import { supabase } from "../../lib/supabase";
import { withSharedSnippet } from "../../lib/shared-snippet";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const cleanUsername = username.trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanUsername)) {
      setError("Username must be 3–24 characters using letters, numbers, or underscores.");
      setBusy(false);
      return;
    }
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: cleanUsername }, emailRedirectTo: window.location.origin + withSharedSnippet("/auth/callback") },
    });
    if (authError) setError(authError.message);
    else if (data.session) window.location.replace(withSharedSnippet("/app"));
    else setMessage("Account created. Check your email, then follow the confirmation link.");
    setBusy(false);
  }

  return (
    <main className="login-shell">
      <section className="login-card auth-form-card" aria-labelledby="signup-title">
        <Brand />
        <h1 id="signup-title">Create your account</h1>
        <p className="subtitle">Start saving multi-file snippets</p>
        <form className="email-form" onSubmit={submit}>
          <label htmlFor="username">Username</label>
          <input id="username" type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" required />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          <button className="email-submit" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
        </form>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-success" role="status">{message}</p>}
        <p className="signup-prompt">Already have an account? <a href="/login" onClick={(e) => { e.currentTarget.href = withSharedSnippet("/login"); }}>Sign in</a></p>
      </section>
    </main>
  );
}
