import { Link } from 'react-router';
import type { Snippet } from '@/src/data/snippets/domain';
import { Button } from '@/src/components/ui/button';
export function ForkGraphHistory({ snippet, onOpenDiffView }: {
  snippet: Snippet; onFork?: () => void; isForking?: boolean; onOpenDiffView?: () => void;
}) {
  return <section aria-label="Fork graph" className="rounded-xl border border-[var(--hairline)] bg-[var(--paper)] p-5">
    <h2 className="font-semibold">Fork graph</h2>
    <p className="mt-1 text-xs text-[var(--secondary-text)]">Public lineage updates automatically. Private and unlisted forks are excluded.</p>
    {snippet.forkGraph.length ? <ul className="mt-4 flex flex-wrap gap-3">
      {snippet.forkGraph.map(node => <li key={node.id} className="rounded-lg border border-[var(--hairline)] p-3">
        <Link className="text-sm font-medium text-[var(--action)]" to={'/snippets/' + node.id}>{node.title}</Link>
        <p className="mt-1 text-xs text-[var(--secondary-text)]">{node.parentId ? 'Fork of ' + (snippet.forkGraph.find(p => p.id === node.parentId)?.title ?? 'public snippet') : 'Original'}</p>
        {node.isCurrent && <small>Current snippet</small>}
      </li>)}
    </ul> : <p className="mt-4 text-sm">Public lineage is available for public snippets.</p>}
    {snippet.forkOriginFiles && <Button className="mt-4" variant="secondary" onClick={onOpenDiffView}>Compare with parent</Button>}
  </section>;
}
