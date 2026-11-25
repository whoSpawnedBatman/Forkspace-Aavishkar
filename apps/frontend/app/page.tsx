"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Brand } from "./brand";
import { supabase } from "../lib/supabase";

function GithubIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="provider-icon"><path fill="currentColor" d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.4 1.23-3.25-.12-.3-.53-1.54.12-3.2 0 0 1-.33 3.3 1.24a11.5 11.5 0 0 1 6 0c2.3-1.57 3.3-1.24 3.3-1.24.65 1.66.24 2.9.12 3.2.76.85 1.23 1.93 1.23 3.25 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22v3.28c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z"/></svg>;
}

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="provider-icon google-icon"><path fill="currentColor" d="M21.35 12.27c0-.72-.06-1.25-.2-1.8H12v3.4h5.37a4.6 4.6 0 0 1-1.99 3.02v2.5h3.22c1.88-1.74 2.75-4.3 2.75-7.12Z"/><path fill="currentColor" d="M12 21.8c2.7 0 4.96-.9 6.62-2.41l-3.22-2.5c-.9.6-2.05.96-3.4.96-2.6 0-4.8-1.76-5.59-4.13H3.08v2.58A10 10 0 0 0 12 21.8Z"/><path fill="currentColor" d="M6.41 13.72a6 6 0 0 1 0-3.44V7.7H3.08a10 10 0 0 0 0 8.6l3.33-2.58Z"/><path fill="currentColor" d="M12 6.15c1.47 0 2.78.5 3.81 1.48l2.86-2.86C16.95 3.16 14.7 2.2 12 2.2a10 10 0 0 0-8.92 5.5l3.33 2.58C7.2 7.91 9.4 6.15 12 6.15Z"/></svg>;
}

function MailIcon() {
  return <svg aria-hidden="true" className="mail-icon" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4.5" width="19" height="15" rx="2" stroke="currentColor" strokeWidth="2"/><path d="m3 6 9 7 9-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <main className="callback-page"><p>Loading…</p></main>;

  if (user) {
    const username = user.user_metadata.username || user.email;
    return (
      <main className="login-shell">
        <section className="login-card account-card">
          <Brand />
          <p className="eyebrow">SIGNED IN</p>
          <h1>Welcome, {username}</h1>
          <p className="subtitle">Your Snipbase session is active.</p>
          <Link className="email-submit dashboard-link" href="/app">Open workspace</Link>
          <button className="auth-button" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </section>
      </main>
    );
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <Brand />
        <h1 id="login-title">Sign in to Snipbase</h1>
        <p className="subtitle">Save and share multi-file snippets</p>
        <div className="provider-list" aria-label="Social sign-in coming later">
          <button className="auth-button" disabled title="Coming later"><GithubIcon /><span>Continue with GitHub</span></button>
          <button className="auth-button" disabled title="Coming later"><GoogleIcon /><span>Continue with Google</span></button>
        </div>
        <div className="divider"><span>or</span></div>
        <Link className="auth-button" href="/login"><MailIcon /><span>Continue with email</span></Link>
        <p className="signup-prompt">New here? <Link href="/signup">Create an account</Link></p>
      </section>
    </main>
  );
}
