import { createDemoId, delay } from "@/data/snippets/demo/async";
import { getScenario } from "@/data/snippets/demo/scenarios";
import {
  AuthAdapterError,
  type AuthAdapter,
  type AuthSession,
  type AuthUser,
  type VerificationChallenge,
} from "@/data/auth/domain";
import { DEMO_ACCOUNTS, DEMO_VERIFICATION_CODE } from "@/data/auth/demo/fixtures";
import {
  clearDemoSession,
  readDemoAccounts,
  readDemoSession,
  readStoredChallenge,
  removeStoredChallenge,
  saveDemoAccount,
  saveStoredChallenge,
  writeDemoSession,
  type StoredChallenge,
} from "@/data/auth/demo/storage";
import { validateStartEmailAuth, validateVerificationCode } from "@/data/auth/validation";

const AUTH_DELAY_MS = 220;
const SLOW_DELAY_MS = 1_100;
const CHALLENGE_TTL_MS = 10 * 60 * 1_000;

function ensureAuthAllowed(): void {
  if (getScenario() === "auth-failure") {
    throw new AuthAdapterError({
      code: "unavailable",
      message: "The active demo scenario blocked sign-in. Clear the scenario and try again.",
    });
  }
}

function toPublicChallenge(stored: StoredChallenge): VerificationChallenge {
  return {
    challengeId: stored.challengeId,
    email: stored.email,
    ...(stored.name ? { name: stored.name } : {}),
    provider: stored.provider,
    mode: stored.mode,
    expiresAt: stored.expiresAt,
    demoCodeHint: stored.expectedCode,
  };
}

export function createDemoAuthAdapter(): AuthAdapter {
  return {
    async getSession(input = {}): Promise<AuthSession | null> {
      const scenario = getScenario();
      await delay(scenario === "slow" ? SLOW_DELAY_MS : 60, input.signal);
      return readDemoSession();
    },

    async startProviderAuth({ provider, mode }): Promise<VerificationChallenge> {
      const scenario = getScenario();
      await delay(scenario === "slow" ? SLOW_DELAY_MS : AUTH_DELAY_MS);
      ensureAuthAllowed();

      const account =
        DEMO_ACCOUNTS.find((entry) => entry.provider === provider) ?? DEMO_ACCOUNTS[0];

      if (!account) {
        throw new AuthAdapterError({ code: "unavailable", message: "No demo account available." });
      }

      const stored: StoredChallenge = {
        challengeId: `verif-${createDemoId()}`,
        email: account.email,
        name: account.name,
        provider,
        mode,
        userId: account.id,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
        expectedCode: DEMO_VERIFICATION_CODE,
      };
      saveStoredChallenge(stored);
      return toPublicChallenge(stored);
    },

    async startEmailAuth(input): Promise<VerificationChallenge> {
      const scenario = getScenario();
      await delay(scenario === "slow" ? SLOW_DELAY_MS : AUTH_DELAY_MS);
      ensureAuthAllowed();

      const validated = validateStartEmailAuth(input);
      if (!validated.value) {
        throw new AuthAdapterError({ code: "invalid", fieldIssues: validated.issues });
      }

      const { mode, email, name } = validated.value;
      const existing = readDemoAccounts().find((entry) => entry.email.toLowerCase() === email);

      if (mode === "signin" && !existing) {
        throw new AuthAdapterError({
          code: "unauthenticated",
          fieldIssues: [
            {
              field: "email",
              message: "No Snip it account found for this email. Create an account instead.",
            },
          ],
          message: "No Snip it account found for this email. Create an account instead.",
        });
      }

      if (mode === "signup" && existing) {
        throw new AuthAdapterError({
          code: "conflict",
          fieldIssues: [{ field: "email", message: "An account with this email already exists." }],
          message: "An account with this email already exists.",
        });
      }

      const stored: StoredChallenge = {
        challengeId: `verif-${createDemoId()}`,
        email,
        name: existing?.name ?? name,
        provider: "email",
        mode,
        ...(existing ? { userId: existing.id } : {}),
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
        expectedCode: DEMO_VERIFICATION_CODE,
      };
      saveStoredChallenge(stored);
      return toPublicChallenge(stored);
    },

    async verifyEmailCode({ challengeId, code }): Promise<AuthSession> {
      const scenario = getScenario();
      await delay(scenario === "slow" ? SLOW_DELAY_MS : AUTH_DELAY_MS);
      ensureAuthAllowed();

      const validated = validateVerificationCode(code);
      if (!validated.value) {
        throw new AuthAdapterError({ code: "invalid", fieldIssues: validated.issues });
      }

      const stored = readStoredChallenge(challengeId);
      if (!stored) {
        throw new AuthAdapterError({
          code: "expired",
          message: "This verification request has expired. Request a new code.",
        });
      }

      if (Date.now() > Date.parse(stored.expiresAt)) {
        removeStoredChallenge(challengeId);
        throw new AuthAdapterError({
          code: "expired",
          message: "This verification code expired. Request a new code.",
        });
      }

      if (validated.value !== stored.expectedCode) {
        throw new AuthAdapterError({
          code: "invalid",
          fieldIssues: [
            {
              field: "code",
              message: "Incorrect verification code. Check the 6 digits and try again.",
            },
          ],
          message: "Incorrect verification code. Check the 6 digits and try again.",
        });
      }

      let user: AuthUser;
      const existing = readDemoAccounts().find(
        (entry) => entry.email.toLowerCase() === stored.email.toLowerCase(),
      );

      if (existing) {
        user = { ...existing, provider: stored.provider, emailVerified: true };
      } else {
        user = {
          id: stored.userId ?? `demo-user-${createDemoId()}`,
          name: stored.name ?? stored.email.split("@")[0] ?? "Snip it user",
          email: stored.email,
          emailVerified: true,
          provider: stored.provider,
        };
        saveDemoAccount(user);
      }

      const session: AuthSession = {
        user,
        signedInAt: new Date().toISOString(),
      };
      writeDemoSession(session);
      removeStoredChallenge(challengeId);
      return session;
    },

    async resendVerificationCode(challengeId): Promise<VerificationChallenge> {
      const scenario = getScenario();
      await delay(scenario === "slow" ? SLOW_DELAY_MS : AUTH_DELAY_MS);
      ensureAuthAllowed();

      const stored = readStoredChallenge(challengeId);
      if (!stored) {
        throw new AuthAdapterError({
          code: "expired",
          message: "Verification session not found. Start sign-in again.",
        });
      }

      const refreshed: StoredChallenge = {
        ...stored,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      };
      saveStoredChallenge(refreshed);
      return toPublicChallenge(refreshed);
    },

    async signOut(): Promise<void> {
      await delay(80);
      clearDemoSession();
    },
  };
}
