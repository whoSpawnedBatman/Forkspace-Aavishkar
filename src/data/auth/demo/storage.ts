import {
  AuthAdapterError,
  type AuthSession,
  type AuthUser,
  type VerificationChallenge,
} from "@/data/auth/domain";
import { DEMO_ACCOUNTS } from "@/data/auth/demo/fixtures";

const SESSION_KEY = "snipit-auth-demo:session:v1";
const ACCOUNTS_KEY = "snipit-auth-demo:accounts:v1";
const CHALLENGES_KEY = "snipit-auth-demo:challenges:v1";

export type StoredChallenge = VerificationChallenge & {
  expectedCode: string;
  userId?: string;
};

function unreadable(): AuthAdapterError {
  return new AuthAdapterError({
    code: "unavailable",
    message: "Demo auth storage could not be read in this browser.",
  });
}

function isUser(value: unknown): value is AuthUser {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string" &&
    candidate.emailVerified === true &&
    (candidate.provider === "github" ||
      candidate.provider === "google" ||
      candidate.provider === "email")
  );
}

export function readDemoSession(): AuthSession | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SESSION_KEY);
  } catch {
    throw unreadable();
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!isUser(parsed.user) || typeof parsed.signedInAt !== "string") return null;
    return { user: parsed.user, signedInAt: parsed.signedInAt };
  } catch {
    return null;
  }
}

export function writeDemoSession(session: AuthSession): void {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new AuthAdapterError({
      code: "unavailable",
      message: "Browser storage is blocked. Allow local storage to keep your demo session.",
    });
  }
}

export function clearDemoSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    throw unreadable();
  }
}

export function readDemoAccounts(): AuthUser[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(ACCOUNTS_KEY);
  } catch {
    return [...DEMO_ACCOUNTS];
  }
  if (!raw) return [...DEMO_ACCOUNTS];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEMO_ACCOUNTS];
    return [...DEMO_ACCOUNTS, ...parsed.filter(isUser)];
  } catch {
    return [...DEMO_ACCOUNTS];
  }
}

export function saveDemoAccount(account: AuthUser): void {
  const existingCustom = readDemoAccounts().filter(
    (entry) => !DEMO_ACCOUNTS.some((seed) => seed.id === entry.id),
  );
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([account, ...existingCustom]));
  } catch {
    throw new AuthAdapterError({
      code: "unavailable",
      message: "Browser storage is blocked. Allow local storage to create a demo account.",
    });
  }
}

export function readStoredChallenge(challengeId: string): StoredChallenge | null {
  try {
    const raw = window.sessionStorage.getItem(CHALLENGES_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, StoredChallenge>;
    return map[challengeId] ?? null;
  } catch {
    return null;
  }
}

export function saveStoredChallenge(challenge: StoredChallenge): void {
  try {
    const raw = window.sessionStorage.getItem(CHALLENGES_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, StoredChallenge>) : {};
    map[challenge.challengeId] = challenge;
    window.sessionStorage.setItem(CHALLENGES_KEY, JSON.stringify(map));
  } catch {
    throw new AuthAdapterError({
      code: "unavailable",
      message: "Session storage is blocked. Allow storage to verify your email in demo mode.",
    });
  }
}

export function removeStoredChallenge(challengeId: string): void {
  try {
    const raw = window.sessionStorage.getItem(CHALLENGES_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, StoredChallenge>;
    delete map[challengeId];
    window.sessionStorage.setItem(CHALLENGES_KEY, JSON.stringify(map));
  } catch {
    // Ignore cleanup errors
  }
}
