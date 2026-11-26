import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getActiveSnippetAdapter } from '@/src/data/snippets/adapter';
import type { Viewer } from '@/src/data/snippets/domain';

const guest: Viewer = { id: 'guest', name: 'Guest', firstName: 'Guest', email: '', initial: 'G', handle: '', role: 'guest', label: 'Guest' };
function viewerOf(session: Session | null): Viewer {
  if (!session) return guest;
  const email = session.user.email ?? '';
  const name = session.user.user_metadata.username || email.split('@')[0] || 'Developer';
  return { id: session.user.id, name, firstName: name.split(' ')[0], email, initial: name[0].toUpperCase(), handle: '', role: 'user', label: name };
}
type AuthResult = { ok: boolean; error?: string; message?: string };
const Context = React.createContext<{
  adapter: ReturnType<typeof getActiveSnippetAdapter>; viewer: Viewer; ready: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  createAccount: (email: string, password: string, name?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>; announce: (message: string) => void;
} | null>(null);

export function SnippetsProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const [viewer, setViewer] = React.useState(guest);
  const [ready, setReady] = React.useState(false);
  const [announcement, announce] = React.useState('');
  React.useEffect(() => {
    let active = true;
    const commit = (session: Session | null) => {
      if (!active) return;
      client.removeQueries({ queryKey: ['snippets'] });
      setViewer(viewerOf(session)); setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => commit(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => commit(session));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [client]);
  const value = {
    adapter: getActiveSnippetAdapter(), viewer, ready, announce,
    async signInWithEmail(email: string, password: string): Promise<AuthResult> {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { ok: false, error: error.message };
      setViewer(viewerOf(data.session));
      return { ok: true };
    },
    async createAccount(email: string, password: string, name?: string): Promise<AuthResult> {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { username: name?.trim() } } });
      if (error) return { ok: false, error: error.message };
      if (!data.session) return { ok: false, message: 'Check your email to confirm your account, then sign in.' };
      setViewer(viewerOf(data.session));
      return { ok: true };
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) { announce(error.message); return; }
      client.removeQueries({ queryKey: ['snippets'] }); setViewer(guest);
    },
  };
  return <Context.Provider value={value}>{ready ? children : <main role="status">Loading your session…</main>}<div className="sr-only" aria-live="polite">{announcement}</div></Context.Provider>;
}
export function useSnippetsContext() {
  const context = React.useContext(Context);
  if (!context) throw new Error('Missing SnippetsProvider');
  return context;
}
