import { useState } from 'react';
import { request } from '@/src/data/snippets/live/liveAdapter';
import { Button } from '@/src/components/ui/button';
export function GrantAccess({ snippetId }: { snippetId: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <form className="flex flex-wrap gap-2 rounded-xl border border-[var(--hairline)] p-4" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await request('/snippets/' + snippetId + '/access', { method: 'PUT', body: JSON.stringify({ email }) });
      setMessage('Viewer access granted. Share the access link with this person.'); setEmail('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not grant access.'); }
    finally { setBusy(false); }
  }}>
    <label className="text-sm">Viewer email <input className="ml-2 rounded border p-2" type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
    <Button disabled={busy} type="submit" variant="secondary">Grant access</Button>
    <p role="status" className="w-full text-sm">{message}</p>
  </form>;
}
