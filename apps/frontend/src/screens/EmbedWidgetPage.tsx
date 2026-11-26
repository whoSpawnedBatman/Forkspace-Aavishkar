import { useEffect } from 'react';
import { useParams } from 'react-router';
import { apiOrigin } from '@/src/data/snippets/live/liveAdapter';
export function EmbedWidgetPage() {
  const { snippetId } = useParams();
  useEffect(() => { window.location.replace(apiOrigin + '/embed/' + encodeURIComponent(snippetId ?? '')); }, [snippetId]);
  return <main role="status">Opening embed…</main>;
}
