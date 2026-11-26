"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Files, LogOut, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthSession, useSignOut } from "@/features/auth/queries";
import { getMode } from "@/data/snippets/adapter";

export function SnippetHeader() {
  const router = useRouter();
  const session = useAuthSession();
  const signOut = useSignOut();
  const demoMode = getMode() === "demo";
  const [signOutError, setSignOutError] = React.useState("");

  const handleSignOut = () => {
    setSignOutError("");
    signOut.mutate(undefined, {
      onSuccess: () => router.replace("/signin"),
      onError: () => setSignOutError("Couldn’t sign out. Please try again."),
    });
  };

  return (
    <header className="site-header sticky top-0 z-30 border-b">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Snip it home" className="site-brand min-h-10 rounded-md">
          <span
            aria-hidden="true"
            className="site-brand-mark flex size-8 items-center justify-center rounded-lg border border-[#26454e] bg-[#0d1a20]"
          >
            <Files className="size-4" />
          </span>
          <span>snip it</span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/snippets"
            className="site-nav-link hidden min-h-10 content-center items-center gap-2 rounded-md px-2 text-sm font-medium sm:inline-flex"
          >
            <BookOpen aria-hidden="true" className="size-4" />
            Explore
          </Link>
          <Link
            href="/snippets/new"
            className="site-primary inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold shadow-[0_0_24px_rgba(139,95,224,0.12)]"
          >
            <Plus aria-hidden="true" className="size-4" />
            New snippet
          </Link>
          {demoMode ? (
            <span className="site-tag hidden rounded-md border px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] sm:inline-flex">
              Local demo
            </span>
          ) : (
            <Link
              href="/signin"
              className="site-nav-link min-h-10 content-center rounded-md px-2 text-sm font-medium"
            >
              Sign in
            </Link>
          )}
          {session.data ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={signOut.isPending}
              className="site-secondary border"
            >
              <LogOut aria-hidden="true" />
              {signOut.isPending ? "Signing out…" : "Sign out"}
            </Button>
          ) : !session.isPending && demoMode ? (
            <Link
              href="/signin"
              className="site-nav-link min-h-10 content-center rounded-md px-2 text-sm font-medium"
            >
              Sign in
            </Link>
          ) : null}
        </nav>
      </div>
      {signOutError ? (
        <p role="alert" className="site-error mx-auto max-w-[1200px] px-4 pb-3 text-right text-sm sm:px-8">
          {signOutError}
        </p>
      ) : null}
    </header>
  );
}
