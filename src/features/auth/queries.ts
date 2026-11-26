"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAuthAdapter } from "@/data/auth/adapter";
import { getMode } from "@/data/snippets/adapter";
import type {
  AuthMode,
  AuthSession,
  StartEmailAuthInput,
  VerificationChallenge,
} from "@/data/auth/domain";

const rootKey = ["auth", getMode()] as const;

export const authKeys = {
  root: rootKey,
  session: () => [...rootKey, "session"] as const,
};

export function useAuthSession() {
  return useQuery({
    queryKey: authKeys.session(),
    queryFn: ({ signal }) => getAuthAdapter().then((adapter) => adapter.getSession({ signal })),
    retry: false,
  });
}

export function useStartProviderAuth() {
  return useMutation<
    VerificationChallenge,
    Error,
    { provider: "github" | "google"; mode: AuthMode }
  >({
    mutationFn: (input) => getAuthAdapter().then((adapter) => adapter.startProviderAuth(input)),
  });
}

export function useStartEmailAuth() {
  return useMutation<VerificationChallenge, Error, StartEmailAuthInput>({
    mutationFn: (input) => getAuthAdapter().then((adapter) => adapter.startEmailAuth(input)),
  });
}

export function useVerifyEmailCode() {
  const queryClient = useQueryClient();

  return useMutation<AuthSession, Error, { challengeId: string; code: string }>({
    mutationFn: (input) => getAuthAdapter().then((adapter) => adapter.verifyEmailCode(input)),
    onSuccess: (session) => {
      queryClient.setQueryData<AuthSession | null>(authKeys.session(), session);
    },
  });
}

export function useResendVerificationCode() {
  return useMutation<VerificationChallenge, Error, string>({
    mutationFn: (challengeId) =>
      getAuthAdapter().then((adapter) => adapter.resendVerificationCode(challengeId)),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => getAuthAdapter().then((adapter) => adapter.signOut()),
    onSuccess: () => {
      queryClient.setQueryData<AuthSession | null>(authKeys.session(), null);
    },
  });
}
