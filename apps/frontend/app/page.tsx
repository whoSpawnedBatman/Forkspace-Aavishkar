"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Brand } from "./brand";
import { supabase } from "../lib/supabase";


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
        <div className="provider-list">
          <Link className="auth-button" href="/login"><MailIcon /><span>Continue with email</span></Link>
        </div>
        <p className="signup-prompt">New here? <Link href="/signup">Create an account</Link></p>
      </section>
    </main>
  );
}
