import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { apiOrigin } from '@/src/data/snippets/live/liveAdapter';
import { supabase } from '@/lib/supabase';
export function RawFilePage() {
  const { snippetId } = useParams();
  const [params] = useSearchParams();
  const path = params.get('file') ?? '';
  const [content, setContent] = useState<string>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setContent(undefined);
    setError('');
    async function load() {
      const { data } = await supabase.auth.getSession();
      const headers = new Headers();
      if (data.session) headers.set('Authorization', 'Bearer ' + data.session.access_token);
      const response = await fetch(apiOrigin + '/snippets/' + encodeURIComponent(snippetId ?? '') + '/raw?path=' + encodeURIComponent(path), { headers, signal: controller.signal });
      if (!response.ok) throw new Error('This file is unavailable or you do not have access.');
      const text = await response.text();
      if (!controller.signal.aborted) setContent(text);
    }
    load().catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load file.');
    });
    return () => controller.abort();
  }, [snippetId, path]);
  if (error) return <main role="alert">{error}</main>;
  if (content === undefined) return <main role="status">Opening raw file…</main>;
  return <pre className="m-4 whitespace-pre-wrap font-mono text-sm">{content}</pre>;
}
