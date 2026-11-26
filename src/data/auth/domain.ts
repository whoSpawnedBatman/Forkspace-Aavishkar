export type AuthProviderId = "github" | "google" | "email";
export type AuthMode = "signin" | "signup";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: true;
  provider: AuthProviderId;
};

export type AuthSession = {
  user: AuthUser;
  signedInAt: string;
};

export type VerificationChallenge = {
  challengeId: string;
  email: string;
  name?: string;
  provider: AuthProviderId;
  mode: AuthMode;
  expiresAt: string;
  demoCodeHint?: string;
};

export type StartEmailAuthInput = {
  mode: AuthMode;
  email: string;
  name?: string;
};

export type AuthFailureCode =
  | "invalid"
  | "unauthenticated"
  | "conflict"
  | "expired"
  | "unavailable"
  | "unknown";

export type AuthFieldIssue = {
  field: "name" | "email" | "code";
  message: string;
};

export type AuthFailure = {
  code: AuthFailureCode;
  message?: string;
  fieldIssues?: readonly AuthFieldIssue[];
};

export interface AuthAdapter {
  getSession(input?: { signal?: AbortSignal }): Promise<AuthSession | null>;
  startProviderAuth(input: {
    provider: "github" | "google";
    mode: AuthMode;
  }): Promise<VerificationChallenge>;
  startEmailAuth(input: StartEmailAuthInput): Promise<VerificationChallenge>;
  verifyEmailCode(input: { challengeId: string; code: string }): Promise<AuthSession>;
  resendVerificationCode(challengeId: string): Promise<VerificationChallenge>;
  signOut(): Promise<void>;
}

export class AuthAdapterError extends Error {
  readonly failure: AuthFailure;

  constructor(failure: AuthFailure) {
    super(failure.message ?? failure.code);
    this.name = "AuthAdapterError";
    this.failure = failure;
  }
}

export function authFailureOf(error: unknown): AuthFailure {
  if (error instanceof AuthAdapterError) return error.failure;
  return { code: "unknown", message: "Sign-in could not be completed. Please try again." };
}
