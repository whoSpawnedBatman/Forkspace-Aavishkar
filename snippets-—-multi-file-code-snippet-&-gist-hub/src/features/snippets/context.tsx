import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { getActiveSnippetAdapter } from '@/src/data/snippets/adapter';
import {
  getDemoScenario,
  resetDemoStore,
  setDemoScenario,
} from '@/src/data/snippets/demo/storage';
import {
  DEFAULT_DEMO_VIEWER,
  SEEDED_DEMO_ACCOUNTS,
  type DemoScenario,
  type SnippetAdapter,
  type Viewer,
} from '@/src/data/snippets/domain';

const VIEWER_STORAGE_KEY = 'snipbase_demo_viewer_v3';
const SIGNED_OUT_STORAGE_KEY = 'snipbase_signed_out_v3';
const CUSTOM_ACCOUNTS_KEY = 'snipbase_custom_accounts_v3';

export interface DemoProgressState {
  createdPublic: boolean;
  copiedEmbed: boolean;
  switchedUser: boolean;
  forkedAndEdited: boolean;
  searchedTag: boolean;
}

interface SnippetsContextValue {
  adapter: SnippetAdapter;
  viewer: Viewer;
  accounts: readonly Viewer[];
  setViewerById: (id: string) => void;
  signInWithEmail: (email: string, password: string) => { ok: boolean; error?: string };
  createAccount: (email: string, password: string, name?: string) => { ok: boolean; error?: string };
  signOut: () => void;
  isSignedOut: boolean;
  scenario: DemoScenario;
  updateScenario: (next: DemoScenario) => void;
  resetDemo: () => void;
  demoProgress: DemoProgressState;
  markDemoStep: (step: keyof DemoProgressState) => void;
  announcement: string;
  announce: (message: string) => void;
}

const SnippetsContext = React.createContext<SnippetsContextValue | null>(null);

function loadCustomAccounts(): Viewer[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Viewer[];
  } catch {
    // Ignore storage read issues
  }
  return [];
}

function saveCustomAccounts(accounts: Viewer[]): void {
  try {
    window.localStorage.setItem(CUSTOM_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage write issues
  }
}

function loadInitialViewer(allAccounts: readonly Viewer[]): Viewer {
  try {
    const savedId = window.sessionStorage.getItem(VIEWER_STORAGE_KEY);
    const match = allAccounts.find((a) => a.id === savedId);
    if (match) return match;
  } catch {
    // Ignore storage access errors
  }
  return DEFAULT_DEMO_VIEWER;
}

export function SnippetsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const adapter = React.useMemo(() => getActiveSnippetAdapter(), []);
  const [customAccounts, setCustomAccounts] = React.useState<Viewer[]>(() =>
    loadCustomAccounts(),
  );
  const accounts = React.useMemo<readonly Viewer[]>(
    () => [...SEEDED_DEMO_ACCOUNTS.slice(0, 2), ...customAccounts, SEEDED_DEMO_ACCOUNTS[2]],
    [customAccounts],
  );
  const [viewer, setViewer] = React.useState<Viewer>(() => loadInitialViewer(accounts));
  const [isSignedOut, setIsSignedOut] = React.useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(SIGNED_OUT_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [scenario, setScenario] = React.useState<DemoScenario>(() => getDemoScenario());
  const [announcement, setAnnouncement] = React.useState('');
  const [demoProgress, setDemoProgress] = React.useState<DemoProgressState>({
    createdPublic: false,
    copiedEmbed: false,
    switchedUser: false,
    forkedAndEdited: false,
    searchedTag: false,
  });

  const announce = React.useCallback((message: string) => {
    setAnnouncement('');
    window.requestAnimationFrame(() => {
      setAnnouncement(message);
    });
  }, []);

  const markDemoStep = React.useCallback((step: keyof DemoProgressState) => {
    setDemoProgress((prev) => (prev[step] ? prev : { ...prev, [step]: true }));
  }, []);

  const commitViewer = React.useCallback(
    (next: Viewer, signedOutFlag = false) => {
      setViewer(next);
      setIsSignedOut(signedOutFlag);
      try {
        window.sessionStorage.setItem(VIEWER_STORAGE_KEY, next.id);
        if (signedOutFlag) {
          window.sessionStorage.setItem(SIGNED_OUT_STORAGE_KEY, 'true');
        } else {
          window.sessionStorage.removeItem(SIGNED_OUT_STORAGE_KEY);
        }
      } catch {
        // Ignore sessionStorage errors
      }
      queryClient.removeQueries({ queryKey: ['snippets'] });
    },
    [queryClient],
  );

  const setViewerById = React.useCallback(
    (id: string) => {
      const next = accounts.find((a) => a.id === id);
      if (!next) return;
      if (next.id === viewer.id && !isSignedOut) return;
      commitViewer(next, false);
      if (next.id !== DEFAULT_DEMO_VIEWER.id && next.role === 'user') {
        markDemoStep('switchedUser');
      }
      announce(`Switched account to ${next.name}.`);
    },
    [accounts, announce, commitViewer, isSignedOut, markDemoStep, viewer.id],
  );

  const signInWithEmail = React.useCallback(
    (rawEmail: string, password: string): { ok: boolean; error?: string } => {
      const email = rawEmail.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return { ok: false, error: 'Enter a valid email address.' };
      }
      if (password.trim().length < 4) {
        return { ok: false, error: 'Password must be at least 4 characters.' };
      }

      const existing = accounts.find(
        (a) => a.role === 'user' && a.email.toLowerCase() === email,
      );
      if (existing) {
        commitViewer(existing);
        if (existing.id !== DEFAULT_DEMO_VIEWER.id) {
          markDemoStep('switchedUser');
        }
        announce(`Signed in as ${existing.email}.`);
        return { ok: true };
      }

      // In browser demo mode, automatically provision an email session if not found
      const localPart = email.split('@')[0];
      const displayName = localPart
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const created: Viewer = {
        id: `user-${localPart.replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}`,
        name: displayName || 'Developer',
        firstName: (displayName || 'Developer').split(' ')[0],
        email,
        initial: (displayName[0] || 'U').toUpperCase(),
        handle: `@${localPart.replace(/[^a-z0-9]/g, '').slice(0, 14) || 'dev'}`,
        role: 'user',
        label: `${displayName} (${email})`,
      };
      const nextCustom = [...customAccounts, created];
      setCustomAccounts(nextCustom);
      saveCustomAccounts(nextCustom);
      commitViewer(created);
      markDemoStep('switchedUser');
      announce(`Signed in as ${email}.`);
      return { ok: true };
    },
    [accounts, announce, commitViewer, customAccounts, markDemoStep],
  );

  const createAccount = React.useCallback(
    (rawEmail: string, password: string, rawName?: string): { ok: boolean; error?: string } => {
      const email = rawEmail.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return { ok: false, error: 'Enter a valid email address.' };
      }
      if (password.trim().length < 6) {
        return { ok: false, error: 'Choose a password with at least 6 characters.' };
      }
      const existing = accounts.find(
        (a) => a.role === 'user' && a.email.toLowerCase() === email,
      );
      if (existing) {
        return {
          ok: false,
          error: 'An account with this email already exists. Use Sign in instead.',
        };
      }

      const fallbackName = email
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const cleanName = rawName?.trim() || fallbackName || 'Developer';
      const created: Viewer = {
        id: `user-${Date.now().toString(36)}`,
        name: cleanName,
        firstName: cleanName.split(' ')[0],
        email,
        initial: cleanName[0].toUpperCase(),
        handle: `@${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'dev'}`,
        role: 'user',
        label: `${cleanName} (${email})`,
      };
      const nextCustom = [...customAccounts, created];
      setCustomAccounts(nextCustom);
      saveCustomAccounts(nextCustom);
      commitViewer(created);
      markDemoStep('switchedUser');
      announce(`Created account for ${cleanName}.`);
      return { ok: true };
    },
    [accounts, announce, commitViewer, customAccounts, markDemoStep],
  );

  const signOut = React.useCallback(() => {
    const guest = SEEDED_DEMO_ACCOUNTS[2];
    commitViewer(guest, true);
    announce('Signed out. Redirecting to sign-in.');
  }, [announce, commitViewer]);

  const updateScenario = React.useCallback(
    (next: DemoScenario) => {
      setDemoScenario(next);
      setScenario(next);
      queryClient.invalidateQueries({ queryKey: ['snippets'] });
      announce(`Demo test scenario set to ${next}.`);
    },
    [announce, queryClient],
  );

  const resetDemo = React.useCallback(() => {
    resetDemoStore();
    setScenario('normal');
    setDemoProgress({
      createdPublic: false,
      copiedEmbed: false,
      switchedUser: false,
      forkedAndEdited: false,
      searchedTag: false,
    });
    queryClient.removeQueries({ queryKey: ['snippets'] });
    queryClient.invalidateQueries({ queryKey: ['snippets'] });
    announce('Demo fixtures reset to initial sample snippets.');
  }, [announce, queryClient]);

  const value = React.useMemo<SnippetsContextValue>(
    () => ({
      adapter,
      viewer,
      accounts,
      setViewerById,
      signInWithEmail,
      createAccount,
      signOut,
      isSignedOut,
      scenario,
      updateScenario,
      resetDemo,
      demoProgress,
      markDemoStep,
      announcement,
      announce,
    }),
    [
      adapter,
      viewer,
      accounts,
      setViewerById,
      signInWithEmail,
      createAccount,
      signOut,
      isSignedOut,
      scenario,
      updateScenario,
      resetDemo,
      demoProgress,
      markDemoStep,
      announcement,
      announce,
    ],
  );

  return (
    <SnippetsContext.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </SnippetsContext.Provider>
  );
}

export function useSnippetsContext(): SnippetsContextValue {
  const ctx = React.useContext(SnippetsContext);
  if (!ctx) {
    throw new Error('useSnippetsContext must be used inside SnippetsProvider');
  }
  return ctx;
}
