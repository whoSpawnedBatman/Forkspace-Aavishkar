"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  Mail,
  RotateCw,
} from "lucide-react";

import { useReducedMotionPreference } from "@/components/motion/use-reduced-motion";
import { SnipItLogo } from "@/components/snipit-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMode } from "@/data/snippets/adapter";
import {
  authFailureOf,
  type AuthMode,
  type VerificationChallenge,
} from "@/data/auth/domain";
import { validateStartEmailAuth, validateVerificationCode } from "@/data/auth/validation";
import { OtpCodeInput } from "@/features/auth/OtpCodeInput";
import {
  useAuthSession,
  useResendVerificationCode,
  useStartEmailAuth,
  useStartProviderAuth,
  useVerifyEmailCode,
} from "@/features/auth/queries";

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-[18px]">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-[17px]">
      <path d="M21.805 10.023H12.2v3.955h5.52c-.238 1.275-.957 2.356-2.038 3.077v2.56h3.297c1.93-1.778 3.046-4.398 3.046-7.515 0-.697-.063-1.39-.22-2.077Z" />
      <path d="M12.2 22c2.756 0 5.068-.913 6.757-2.385l-3.297-2.56c-.914.614-2.083.978-3.46.978-2.66 0-4.916-1.796-5.72-4.212H3.074v2.64A10.197 10.197 0 0 0 12.2 22Z" />
      <path d="M6.48 13.821a6.12 6.12 0 0 1 0-3.642V7.54H3.074a10.2 10.2 0 0 0 0 8.92l3.406-2.639Z" />
      <path d="M12.2 5.967c1.498 0 2.845.515 3.904 1.526l2.927-2.927C17.262 2.913 14.95 2 12.2 2a10.197 10.197 0 0 0-9.126 5.54l3.406 2.639c.804-2.416 3.06-4.212 5.72-4.212Z" />
    </svg>
  );
}

const PROVIDER_LABELS: Record<"github" | "google" | "email", string> = {
  github: "GitHub",
  google: "Google",
  email: "Email",
};

export function AuthExperience({ initialMode = "signin" }: { initialMode?: AuthMode }) {
  const demoMode = getMode() === "demo";
  const reduceMotion = useReducedMotionPreference();
  const router = useRouter();

  const { data: session, isPending: sessionLoading } = useAuthSession();
  const startProvider = useStartProviderAuth();
  const startEmail = useStartEmailAuth();
  const verifyCode = useVerifyEmailCode();
  const resendCode = useResendVerificationCode();

  // modeOverride is set when the user clicks "Create an account" / "Sign in" in-flow
  const [modeOverride, setModeOverride] = React.useState<AuthMode | null>(null);
  const mode = modeOverride ?? initialMode;
  const setMode = (next: AuthMode) => setModeOverride(next);

  const [step, setStep] = React.useState<"choose" | "email" | "verify">("choose");
  const [activeProvider, setActiveProvider] = React.useState<"github" | "google" | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [challenge, setChallenge] = React.useState<VerificationChallenge | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{
    name?: string;
    email?: string;
    code?: string;
  }>({});
  const [bannerError, setBannerError] = React.useState<string | null>(null);
  const [statusNote, setStatusNote] = React.useState("");
  const [cooldown, setCooldown] = React.useState(0);

  const nameRef = React.useRef<HTMLInputElement>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const codeRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  React.useEffect(() => {
    if (session) router.replace("/snippets");
  }, [router, session]);

  const busy =
    startProvider.isPending ||
    startEmail.isPending ||
    verifyCode.isPending ||
    resendCode.isPending;

  const resetTransient = () => {
    setFieldErrors({});
    setBannerError(null);
    setStatusNote("");
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setStep("choose");
    setChallenge(null);
    setCode("");
    resetTransient();
  };

  const handleProviderClick = (provider: "github" | "google") => {
    if (busy) return;
    resetTransient();
    setActiveProvider(provider);
    startProvider.mutate(
      { provider, mode },
      {
        onSuccess: (nextChallenge) => {
          setChallenge(nextChallenge);
          setCode("");
          setCooldown(30);
          setStep("verify");
          setActiveProvider(null);
          window.setTimeout(() => codeRef.current?.focus(), 20);
        },
        onError: (error) => {
          setActiveProvider(null);
          setBannerError(authFailureOf(error).message ?? "Could not start sign-in.");
        },
      },
    );
  };

  const handleEmailSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    resetTransient();

    const validated = validateStartEmailAuth({ mode, email, name });
    if (!validated.value) {
      const nextErrors: { name?: string; email?: string } = {};
      for (const issue of validated.issues) {
        if (issue.field === "name") nextErrors.name = issue.message;
        if (issue.field === "email") nextErrors.email = issue.message;
      }
      setFieldErrors(nextErrors);
      if (nextErrors.name) nameRef.current?.focus();
      else if (nextErrors.email) emailRef.current?.focus();
      return;
    }

    startEmail.mutate(validated.value, {
      onSuccess: (nextChallenge) => {
        setChallenge(nextChallenge);
        setCode("");
        setCooldown(30);
        setStep("verify");
        window.setTimeout(() => codeRef.current?.focus(), 20);
      },
      onError: (error) => {
        const failure = authFailureOf(error);
        const nextErrors: { name?: string; email?: string } = {};
        for (const issue of failure.fieldIssues ?? []) {
          if (issue.field === "name") nextErrors.name = issue.message;
          if (issue.field === "email") nextErrors.email = issue.message;
        }
        setFieldErrors(nextErrors);
        if (nextErrors.name) nameRef.current?.focus();
        else if (nextErrors.email) emailRef.current?.focus();
        if (!nextErrors.name && !nextErrors.email) {
          setBannerError(failure.message ?? "Could not send verification code.");
        }
      },
    });
  };

  const handleVerifySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !challenge) return;
    resetTransient();

    const validated = validateVerificationCode(code);
    if (!validated.value) {
      setFieldErrors({ code: validated.issues[0]?.message });
      codeRef.current?.focus();
      return;
    }

    verifyCode.mutate(
      { challengeId: challenge.challengeId, code: validated.value },
      {
        onError: (error) => {
          const failure = authFailureOf(error);
          const codeIssue = failure.fieldIssues?.find((issue) => issue.field === "code");
          if (codeIssue) {
            setFieldErrors({ code: codeIssue.message });
            codeRef.current?.focus();
          } else {
            setBannerError(failure.message ?? "Verification failed.");
          }
        },
      },
    );
  };

  const handleResend = () => {
    if (busy || cooldown > 0 || !challenge) return;
    resetTransient();
    resendCode.mutate(challenge.challengeId, {
      onSuccess: (refreshed) => {
        setChallenge(refreshed);
        setCooldown(30);
        setStatusNote(`A new verification code was sent to ${refreshed.email}.`);
        codeRef.current?.focus();
      },
      onError: (error) => {
        setBannerError(authFailureOf(error).message ?? "Could not resend code.");
      },
    });
  };

  if (sessionLoading || session) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-dvh items-center justify-center bg-canvas px-4 focus:outline-none"
      >
        <div role="status" className="flex flex-col items-center gap-4 text-sm text-muted">
          <SnipItLogo />
          <span>{session ? "Opening your snippets…" : "Checking session…"}</span>
        </div>
      </main>
    );
  }

  const transition = { duration: reduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-clip bg-canvas px-4 py-12 focus:outline-none"
      style={{
        backgroundImage:
          "radial-gradient(65% 42% at 50% 0%, rgba(59, 130, 246, 0.065), transparent 72%)",
      }}
    >
      <div className="w-full max-w-[348px]">
        <div className="flex justify-center">
          <SnipItLogo />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === "choose" ? (
            <motion.section
              key={`choose-${mode}`}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={transition}
              aria-labelledby="auth-heading"
              className="mt-7 text-center"
            >
              <h1
                id="auth-heading"
                className="text-[28px] font-semibold leading-tight tracking-[-0.028em] text-ink sm:text-[31px]"
              >
                {mode === "signin" ? "Sign in to Snip it" : "Create your Snip it account"}
              </h1>
              <p className="mt-2 text-[14.5px] leading-6 text-muted">
                Save and share multi-file snippets
              </p>

              {bannerError ? (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-2.5 rounded-control border border-error/35 bg-error-bg px-3.5 py-2.5 text-left text-xs leading-5 text-error"
                >
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>{bannerError}</span>
                </div>
              ) : null}

              <div className="mt-8 space-y-3">
                <Button
                  variant="provider"
                  size="lg"
                  className="w-full justify-center font-medium"
                  onClick={() => handleProviderClick("github")}
                  disabled={busy}
                >
                  <GitHubIcon />
                  {activeProvider === "github" ? "Connecting to GitHub…" : "Continue with GitHub"}
                </Button>

                <Button
                  variant="provider"
                  size="lg"
                  className="w-full justify-center font-medium"
                  onClick={() => handleProviderClick("google")}
                  disabled={busy}
                >
                  <GoogleIcon />
                  {activeProvider === "google" ? "Connecting to Google…" : "Continue with Google"}
                </Button>

                <div className="flex items-center gap-3.5 py-1.5" aria-hidden="true">
                  <span className="h-px flex-1 bg-hairline" />
                  <span className="text-[13px] text-muted">or</span>
                  <span className="h-px flex-1 bg-hairline" />
                </div>

                <Button
                  variant="provider"
                  size="lg"
                  className="w-full justify-center font-medium"
                  onClick={() => {
                    resetTransient();
                    setStep("email");
                    window.setTimeout(
                      () => (mode === "signup" ? nameRef.current : emailRef.current)?.focus(),
                      20,
                    );
                  }}
                  disabled={busy}
                >
                  <Mail aria-hidden="true" className="size-[17px]" />
                  Continue with email
                </Button>
              </div>

              <p className="mt-7 text-[13.5px] text-muted">
                {mode === "signin" ? (
                  <>
                    New here?{" "}
                    <Link
                      href="/signup"
                      onClick={(event) => {
                        event.preventDefault();
                        switchMode("signup");
                        window.history.replaceState(null, "", "/signup");
                      }}
                      className="font-medium text-action-link underline-offset-4 hover:underline"
                    >
                      Create an account
                    </Link>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <Link
                      href="/signin"
                      onClick={(event) => {
                        event.preventDefault();
                        switchMode("signin");
                        window.history.replaceState(null, "", "/signin");
                      }}
                      className="font-medium text-action-link underline-offset-4 hover:underline"
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </p>
            </motion.section>
          ) : null}

          {step === "email" ? (
            <motion.section
              key={`email-${mode}`}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={transition}
              aria-labelledby="email-heading"
              className="mt-7"
            >
              <button
                type="button"
                onClick={() => {
                  resetTransient();
                  setStep("choose");
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-1 text-xs font-medium text-muted transition-colors hover:text-ink"
              >
                <ArrowLeft aria-hidden="true" className="size-3.5" />
                Back to sign-in options
              </button>

              <h1
                id="email-heading"
                className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink"
              >
                {mode === "signin" ? "Sign in with email" : "Create your account"}
              </h1>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                We’ll send a 6-digit verification code to confirm your email.
              </p>

              {bannerError ? (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2.5 rounded-control border border-error/35 bg-error-bg px-3.5 py-2.5 text-xs leading-5 text-error"
                >
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>{bannerError}</span>
                </div>
              ) : null}

              <form onSubmit={handleEmailSubmit} noValidate className="mt-6 space-y-4">
                {mode === "signup" ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="auth-name">Full name</Label>
                    <Input
                      id="auth-name"
                      ref={nameRef}
                      type="text"
                      autoComplete="name"
                      placeholder="Rishi Jayaram"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setFieldErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      disabled={busy}
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={fieldErrors.name ? "auth-name-error" : undefined}
                    />
                    {fieldErrors.name ? (
                      <p id="auth-name-error" role="alert" className="text-xs text-error">
                        {fieldErrors.name}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-1.5">
                  <Label htmlFor="auth-email">Email address</Label>
                  <Input
                    id="auth-email"
                    ref={emailRef}
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    disabled={busy}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
                  />
                  {fieldErrors.email ? (
                    <p id="auth-email-error" role="alert" className="text-xs text-error">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </div>

                {demoMode && mode === "signin" ? (
                  <div className="flex items-center justify-between gap-2 rounded-control border border-hairline bg-paper px-3 py-2 text-xs text-muted">
                    <span>Demo user: rishi@snipit.dev</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("rishi@snipit.dev");
                        setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      className="font-medium text-action-link hover:underline"
                    >
                      Use demo
                    </button>
                  </div>
                ) : null}

                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {startEmail.isPending ? "Sending verification code…" : "Send verification code"}
                </Button>
              </form>
            </motion.section>
          ) : null}

          {step === "verify" && challenge ? (
            <motion.section
              key="verify"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={transition}
              aria-labelledby="verify-heading"
              className="mt-7"
            >
              <button
                type="button"
                onClick={() => {
                  resetTransient();
                  setChallenge(null);
                  setCode("");
                  setStep(challenge.provider === "email" ? "email" : "choose");
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-1 text-xs font-medium text-muted transition-colors hover:text-ink"
              >
                <ArrowLeft aria-hidden="true" className="size-3.5" />
                Use another sign-in method
              </button>

              <h1
                id="verify-heading"
                className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink"
              >
                Verify your email
              </h1>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                {challenge.provider === "email" ? (
                  <>
                    Enter the 6-digit code sent to{" "}
                    <span className="font-mono text-ink">{challenge.email}</span>.
                  </>
                ) : (
                  <>
                    Confirm your {PROVIDER_LABELS[challenge.provider]} sign-in by entering the
                    6-digit verification code sent to{" "}
                    <span className="font-mono text-ink">{challenge.email}</span>.
                  </>
                )}
              </p>

              {bannerError ? (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2.5 rounded-control border border-error/35 bg-error-bg px-3.5 py-2.5 text-xs leading-5 text-error"
                >
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>{bannerError}</span>
                </div>
              ) : null}

              <form onSubmit={handleVerifySubmit} noValidate className="mt-6 space-y-4">
                <div className="grid gap-2">
                  <OtpCodeInput
                    ref={codeRef}
                    value={code}
                    onChange={(next) => {
                      setCode(next);
                      setFieldErrors((prev) => ({ ...prev, code: undefined }));
                    }}
                    disabled={busy}
                    hasError={Boolean(fieldErrors.code)}
                    describedBy={fieldErrors.code ? "verify-code-error" : undefined}
                  />
                  {fieldErrors.code ? (
                    <p id="verify-code-error" role="alert" className="text-xs text-error">
                      {fieldErrors.code}
                    </p>
                  ) : null}
                </div>

                {challenge.demoCodeHint ? (
                  <div className="flex items-center justify-between gap-2 rounded-control border border-hairline bg-paper px-3 py-2 text-xs text-muted">
                    <span>
                      Demo code:{" "}
                      <code className="font-mono font-semibold text-ink">
                        {challenge.demoCodeHint}
                      </code>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCode(challenge.demoCodeHint ?? "");
                        setFieldErrors((prev) => ({ ...prev, code: undefined }));
                      }}
                      className="font-medium text-action-link hover:underline"
                    >
                      Fill code
                    </button>
                  </div>
                ) : null}

                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {verifyCode.isPending ? "Verifying…" : "Verify & continue"}
                </Button>
              </form>

              <div className="mt-5 flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={busy || cooldown > 0}
                  className="inline-flex items-center gap-1.5 font-medium text-action-link hover:underline disabled:text-muted disabled:no-underline"
                >
                  <RotateCw aria-hidden="true" className="size-3.5" />
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
                <span className="text-muted">Expires in 10 min</span>
              </div>

              <p role="status" aria-live="polite" className="mt-2 min-h-4 text-xs text-selected-ink">
                {statusNote}
              </p>
            </motion.section>
          ) : null}
        </AnimatePresence>

        {demoMode ? (
          <p className="mt-10 text-center text-xs text-muted">
            Demo mode · Verification runs locally in this browser
          </p>
        ) : null}
      </div>
    </main>
  );
}
