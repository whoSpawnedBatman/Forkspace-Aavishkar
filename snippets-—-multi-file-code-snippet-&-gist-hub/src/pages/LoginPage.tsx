import { AlertCircle, ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as React from 'react';
import { Link, useNavigate } from 'react-router';
import { SnipbaseMark } from '@/src/components/SnipbaseMark';
import { Button } from '@/src/components/ui/button';
import { Input, Label } from '@/src/components/ui/input';
import { useSnippetsContext } from '@/src/features/snippets/context';
import { EASE_OUT_EXPO, INSTANT_TRANSITION, TRANSITION_BASE } from '@/src/lib/motion';

export function LoginPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { signInWithEmail, createAccount } = useSnippetsContext();

  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('rishijayaram13@gmail.com');
  const [password, setPassword] = React.useState('demo1234');
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res =
      mode === 'signin'
        ? signInWithEmail(email, password)
        : createAccount(email, password, name);

    if (!res.ok) {
      setError(res.error ?? 'Authentication failed.');
      return;
    }

    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] flex flex-col justify-center px-4 py-12">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion ? INSTANT_TRANSITION : { duration: 0.22, ease: EASE_OUT_EXPO }
        }
        className="mx-auto w-full max-w-[380px]"
      >
        {/* Brand lockup matching Snipbase auth reference */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2.5 text-[var(--ink)]">
            <SnipbaseMark className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight">Snipbase</span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_BASE}
            >
              <h1 className="mt-6 text-2xl font-bold tracking-tight text-[var(--ink)]">
                {mode === 'signin' ? 'Sign in with email' : 'Create your account'}
              </h1>
              <p className="mt-1.5 text-sm text-[var(--secondary-text)]">
                {mode === 'signin'
                  ? 'Welcome back to Snipbase'
                  : 'Author, embed, and fork multi-file snippets'}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Auth Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 space-y-4 rounded-[18px] border border-[var(--hairline)] bg-[var(--paper)] p-6 [box-shadow:var(--shadow)]"
        >
          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                key="auth-error"
                role="alert"
                initial={prefersReducedMotion ? false : { opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, height: 0 }}
                transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_BASE}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-2 rounded-[8px] border border-[var(--error-border)] bg-[var(--error-surface)] px-3.5 py-2.5 text-xs text-[var(--error-ink)]">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {mode === 'signup' && (
              <motion.div
                key="signup-name-field"
                initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={prefersReducedMotion ? INSTANT_TRANSITION : TRANSITION_BASE}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 pb-1">
                  <Label htmlFor="auth-name" className="text-xs text-[var(--secondary-text)]">
                    Display name
                  </Label>
                  <Input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Ananya K"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <Label htmlFor="auth-email" className="text-xs text-[var(--secondary-text)]">
              Email
            </Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-password" className="text-xs text-[var(--secondary-text)]">
              Password
            </Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full mt-2">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        {/* Toggle / Back links matching Screenshot 1 */}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[var(--secondary-text)]">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[var(--action-bright)] hover:underline"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            Back
          </Link>
          <span aria-hidden="true">·</span>
          {mode === 'signin' ? (
            <>
              <span>New here?</span>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setEmail('');
                  setPassword('');
                }}
                className="text-[var(--action-bright)] hover:underline cursor-pointer"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              <span>Already have an account?</span>
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="text-[var(--action-bright)] hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
